const { createClient } = require('@supabase/supabase-js');

const url = "https://cofdsbczmrkriohlgyct.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

const supabase = createClient(url, key);

async function check() {
    const { data: q1, error } = await supabase.from('orders')
        .select('driver:profiles!driver_id (name), customer_phone, delivery_address')
        .not('driver_id', 'is', null)
        .limit(1);
    console.log("Joined driver data:", q1, "Error:", error);
}

check();
