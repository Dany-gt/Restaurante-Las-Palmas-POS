const { createClient } = require('@supabase/supabase-js');

const url = "https://cofdsbczmrkriohlgyct.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

const supabase = createClient(url, key);

async function findAnyDiscount() {
    const { data: d1 } = await supabase.from('orders').select('id').gt('discount_amount', 0).limit(1);
    const { data: d2 } = await supabase.from('orders').select('id').gt('discount_percentage', 0).limit(1);

    console.log("Found discount_amount > 0:", d1?.[0]?.id || "None");
    console.log("Found discount_percentage > 0:", d2?.[0]?.id || "None");
}

findAnyDiscount();
