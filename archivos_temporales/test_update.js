const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testPriceZero() {
    const itemId = '99ecc7f6-c9d8-4da4-9333-07ee81a437a4'; // MAS LIMON
    console.log(`Setting price to 0 for item ${itemId}...`);

    const { error: updateError } = await supabase.from('group_items').update({ extra_price: 0 }).eq('id', itemId);

    if (updateError) {
        console.error('Update failed:', updateError);
        return;
    }

    const { data: verified } = await supabase.from('group_items').select('*').eq('id', itemId).single();
    console.log('Verified price in DB:', verified.extra_price);

    // Restore for now to avoid breaking their data permanently if they want it back
    // await supabase.from('group_items').update({ extra_price: 0.6 }).eq('id', itemId);
}

testPriceZero();
