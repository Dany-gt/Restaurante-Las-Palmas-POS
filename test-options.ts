import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';

// We need to read from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    // search for product AGUA CHILE MIXTO
    const { data: products } = await supabase.from('products').select('*').ilike('name', '%AGUA CHILE MIXTO%');
    console.log('Products:', products?.map(p => ({ id: p.id, name: p.name })));

    if (products && products.length > 0) {
        const pid = products[0].id;
        
        // 1. check check_if_customizable
        const { data: isCust, error: e1 } = await supabase.rpc('check_if_customizable', { p_id: pid });
        console.log('check_if_customizable:', isCust, e1);

        // 2. check product_option_groups
        const { data: opts, error: e2 } = await supabase.from('product_option_groups').select('*').eq('product_id', pid);
        console.log('product_option_groups:', opts?.length, e2);

        // 3. check group_items
        const { data: gItems, error: e3 } = await supabase.from('group_items').select('*').eq('product_id', pid);
        console.log('group_items (master groups):', gItems?.length, e3);
    }
}

main().catch(console.error);
