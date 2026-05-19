const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
    const searchNames = [
        'AGUACATE EN LASCAS 3 ONZAS',
        'ADEREZO RANCH',
        'ADEREZO MIL ISLAS',
        'PECHUGUITA DE POLLO CON HELADO'
    ];

    const { data: products, error: pErr } = await supabase
        .from('products')
        .select(`
            id,
            name,
            category_id,
            categories(id, name, section)
        `)
        .in('name', searchNames);

    if (pErr) {
        console.error('Error fetching products:', pErr);
        return;
    }

    console.log('--- PRODUCTS IN DB ---');
    console.log(JSON.stringify(products, null, 2));
    console.log('----------------------');
}

checkProducts();
