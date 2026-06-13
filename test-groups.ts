import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: products } = await supabase.from('products').select('*').ilike('name', '%AGUA CHILE MIXTO%');
    if (!products || products.length === 0) return;
    const pid = products[0].id;
    
    const { data: opts } = await supabase.from('product_option_groups').select('*, option_groups(*)').eq('product_id', pid);
    console.log('product_option_groups with details:', JSON.stringify(opts, null, 2));
}

main().catch(console.error);
