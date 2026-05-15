const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRPC(name) {
    console.log(`--- Inspecting ${name} ---`);
    // Try exec_sql
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: `SELECT routine_definition FROM information_schema.routines WHERE routine_name = '${name}'` 
    });

    if (error) {
        console.error('exec_sql error:', error.message);
        // Try execute_sql as fallback
        const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { 
            sql: `SELECT routine_definition FROM information_schema.routines WHERE routine_name = '${name}'` 
        });
        if (e2) {
            console.error('execute_sql error:', e2.message);
        } else {
            console.log(JSON.stringify(d2, null, 2));
        }
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

async function main() {
    await inspectRPC('void_item_with_pin');
    await inspectRPC('cancel_order_with_pin');
}

main();
