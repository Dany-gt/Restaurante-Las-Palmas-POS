import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: products } = await supabase.from('products').select('*').ilike('name', '%AGUA CHILE MIXTO%');
    if (!products || products.length === 0) return;
    const pid = products[0].id;
    
    const { data: opts } = await supabase.from('product_option_groups').select('*').eq('product_id', pid);
    
    if (opts && opts.length > 0) {
        const groupIds = opts.map(o => o.group_id);
        const { data: items } = await supabase.from('group_items').select('*').in('option_group_id', groupIds);
        console.log('all group_items for these groups:', items);

        const { data: oldOpts } = await supabase.from('options').select('*').in('group_id', groupIds);
        console.log('options table items:', oldOpts);
    }
}

main().catch(console.error);
