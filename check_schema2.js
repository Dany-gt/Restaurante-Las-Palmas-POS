const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_tables_and_columns'); // might not exist
  // Let's use standard query via pg_class or just raw sql if we can't...
  // wait, supabase JS doesn't support raw queries directly unless via RPC.
  
  // Let's list all tables by trying to query them or we can just run psql if we had the connection string.
  // Actually, we can fetch from information_schema via a REST endpoint if it's exposed? No, it's blocked.
  
  // Let's try guessing: option_branch, option_group_branch, branch_options
  const guesses = [
      'option_group_branches',
      'branch_option_groups',
      'option_branches',
      'branch_options',
      'modifier_group_branches',
      'product_branch_options'
  ];
  
  for (const t of guesses) {
      const res = await supabase.from(t).select('*').limit(1);
      if (!res.error) {
          console.log("FOUND TABLE:", t, Object.keys(res.data[0] || {}));
      }
  }
}
checkSchema();
