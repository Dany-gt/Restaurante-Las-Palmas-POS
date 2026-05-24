const url = "https://cofdsbczmrkriohlgyct.supabase.co/rest/v1/orders?select=*&is_contingency=eq.true&order=created_at.desc";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
})
.then(r => {
  if (!r.ok) {
    return r.text().then(text => { throw new Error(text) });
  }
  return r.json();
})
.then(data => {
  console.log("=== ALL CONTINGENCY ORDERS ===");
  console.log("Total contingency orders found:", data.length);
  data.forEach(o => {
    console.log(`Order #${o.order_number}`);
    console.log(`  ID: ${o.id}`);
    console.log(`  Created: ${o.created_at}`);
    console.log(`  Status: ${o.status}`);
    console.log(`  Total: ${o.total}`);
    console.log(`  Payment: ${o.payment_method}`);
    console.log(`  Card amount: ${o.card_amount}`);
    console.log(`  Cash amount: ${o.cash_amount}`);
    console.log(`  Contingency: ${o.is_contingency}`);
    console.log(`  Invoice UUID: ${o.invoice_uuid}`);
    console.log("------------------------");
  });
})
.catch(console.error);
