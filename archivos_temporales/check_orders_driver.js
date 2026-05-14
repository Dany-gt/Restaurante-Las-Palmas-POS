const { createClient } = require('@supabase/supabase-js');

const url = "https://cofdsbczmrkriohlgyct.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

const supabase = createClient(url, key);

async function check() {
    console.log("Checking orders table join to driver");
    // Just grab one order with a driver_id to see if driver_id holds a uuid or something.
    const { data: q1 } = await supabase.from('orders').select('driver_id').not('driver_id', 'is', null).limit(1);
    console.log("Driver ID sample:", q1);
}

check();
