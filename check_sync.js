const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGroups() {
    console.log('--- Searching for Groups named VEGETALES ---');
    const { data: modGroups } = await supabase.from('modifier_groups').select('*').ilike('name', '%VEGETALES%');
    modGroups?.forEach(g => console.log(`Modifier Group: "${g.name}", ID: ${g.id}`));

    const { data: optGroups } = await supabase.from('option_groups').select('*').ilike('name', '%VEGETALES%');
    optGroups?.forEach(g => console.log(`Option Group: "${g.name}", ID: ${g.id}`));
}

checkGroups();
