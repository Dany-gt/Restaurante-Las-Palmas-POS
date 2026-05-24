const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY";
const ordersUrl = "https://cofdsbczmrkriohlgyct.supabase.co/rest/v1/orders?select=id,order_number,status,subtotal,tax_amount,tip_amount,total,is_contingency,created_at,table_id&order_number=in.(506,507,508,509,510)";
const itemsUrl = "https://cofdsbczmrkriohlgyct.supabase.co/rest/v1/order_items?select=*&order_id=in.";

async function main() {
  const rOrders = await fetch(ordersUrl, {
    headers: { "apikey": key, "Authorization": `Bearer ${key}` }
  });
  const orders = await rOrders.json();
  console.log("=== ORDERS ===");
  console.log(orders);

  const orderIds = orders.map(o => o.id);
  const itemsRes = await fetch(itemsUrl + `(${orderIds.join(',')})`, {
    headers: { "apikey": key, "Authorization": `Bearer ${key}` }
  });
  const items = await itemsRes.json();
  console.log("=== ORDER ITEMS ===");
  console.log(items.map(item => ({ order_id: item.order_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, status: item.status })));
}

main().catch(console.error);
