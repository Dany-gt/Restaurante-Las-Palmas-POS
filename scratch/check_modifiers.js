const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('--- BUSCANDO MODIFICADORES EN GROUP_ITEMS ---');
    const { data, error } = await supabase
      .from('group_items')
      .select(`
        *,
        modifier_groups (id, name)
      `)
      .not('modifier_group_id', 'is', null)
      .order('item_name');

    if (error) throw error;

    console.log(`Total group_items (modificadores): ${data.length}`);
    data.forEach(item => {
      console.log(`ID: ${item.id} | Name: ${item.item_name} | Display: ${item.display_name} | Group: ${item.modifier_groups?.name || 'N/A'} (ID: ${item.modifier_group_id}) | Price: Q${item.extra_price}`);
    });

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();
