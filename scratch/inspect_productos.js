const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- CATEGORIES (SECTION=INVENTARIO) ---');
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('section', 'INVENTARIO');
    
    if (catError) console.error(catError);
    else console.table(categories);

    console.log('\n--- PRODUCTS (ES_PLATILLO=FALSE) ---');
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, category_id')
        .eq('es_platillo', false)
        .limit(20);
    
    if (prodError) console.error(prodError);
    else console.table(products);
}

checkData();
