const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    // try with parameter 'sql' instead of 'query'
    const { data: res, error: err } = await supabase.rpc('execute_sql', { sql: `
        ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "cashier_id" uuid;
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_cashier_id_fkey') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."profiles"("id");
        END IF; END $$;
    ` });
    
    console.log("Migration Error (sql):", err);
    console.log("Migration Result (sql):", res);
})();
