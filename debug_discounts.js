const { createClient } = require('@supabase/supabase-js');

const url = "https://cofdsbczmrkriohlgyct.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

const supabase = createClient(url, key);

async function debugDiscounts() {
    const { data, error } = await supabase.from('orders')
        .select('id, order_number, status, discount_amount, discount_reason')
        .eq('status', 'completed')
        .gt('discount_amount', 0)
        .limit(10);

    if (error) {
        console.error(error);
    } else {
        console.log("Orders with discount > 0:", JSON.stringify(data, null, 2));
    }
}

debugDiscounts();
