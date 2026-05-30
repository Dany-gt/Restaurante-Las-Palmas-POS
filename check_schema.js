const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('branches').select('*').limit(1);
  if (!error) console.log("Branches table exists.");

  const tablesToCheck = ['option_group_branches', 'modifier_group_branches', 'group_branches'];
  for (const t of tablesToCheck) {
      const res = await supabase.from(t).select('*').limit(1);
      if (!res.error) {
          console.log(t + " EXISTS!", Object.keys(res.data[0] || {}));
      }
  }
}
checkSchema();
