const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchProducts() {
    const { data, error } = await supabase
        .from('products')
        .select(`
            id,
            name,
            category_id,
            categories(id, name, section)
        `);

    if (error) {
        console.error('Error:', error);
        return;
    }

    const filtered = data.filter(p => 
        p.name.toUpperCase().includes('AGUACATE') || 
        p.name.toUpperCase().includes('RANCH')
    );

    console.log('--- PRODUCTS CONTAINING AGUACATE/RANCH ---');
    console.log(JSON.stringify(filtered, null, 2));
    console.log('-----------------------------------------');
}

searchProducts();
