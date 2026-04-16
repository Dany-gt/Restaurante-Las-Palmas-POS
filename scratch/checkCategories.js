const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    const { data: prodCats } = await supabase.from('product_categories').select('id, nombre');
    console.log('--- PRODUCT CATEGORIES ---');
    console.log(prodCats);
    
    const { data: cats } = await supabase.from('categories').select('id, name, section');
    console.log('--- GENERAL CATEGORIES ---');
    console.log(cats);
}

checkCategories();
