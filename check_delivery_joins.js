const { createClient } = require('@supabase/supabase-js');

const url = "https://cofdsbczmrkriohlgyct.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

const supabase = createClient(url, key);

async function check() {
    const { data: q1, error: e1 } = await supabase.from('orders').select('customer:customers ( email )').limit(1);
    const { data: q2, error: e2 } = await supabase.from('orders').select('driver:delivery_drivers ( name )').limit(1);

    console.log("Customer join:", q1, "Error:", e1?.message);
    console.log("Driver join:", q2, "Error:", e2?.message);
}

check();
