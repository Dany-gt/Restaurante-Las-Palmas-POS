const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('--- BUSCANDO ORDENES DE AYER Y HOY (21 Y 22 DE MAYO) ---');
    
    // Query orders from May 20th onwards
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, tables(*)')
      .gte('created_at', '2026-05-20T00:00:00Z')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    console.log(`Encontradas ${orders.length} órdenes.`);
    orders.forEach(o => {
      console.log(`Orden ID: ${o.id} | Número: ${o.order_number} | Estado: ${o.status} | Total: ${o.total} | Propina: ${o.tip_amount} | Creado: ${o.created_at} | Mesa: ${o.tables?.number || o.table_id}`);
    });

    console.log('\n--- BUSCANDO FACTURAS EN CONTINGENCIA (SERIE CONT O SIN UUID) ---');
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .gte('created_at', '2026-05-20T00:00:00Z')
      .order('created_at', { ascending: false });

    if (invoicesError) throw invoicesError;

    console.log(`Encontradas ${invoices.length} facturas.`);
    invoices.forEach(inv => {
      console.log(`Factura ID: ${inv.id} | Orden ID: ${inv.order_id} | NIT: ${inv.customer_nit} | Nombre: ${inv.customer_name} | Serie: ${inv.series} | UUID: ${inv.uuid} | Total: ${inv.grand_total} | Propina: ${inv.tip_amount} | Creado: ${inv.created_at}`);
    });

    console.log('\n--- TABLAS QUE ESTAN CONFIGURADAS COMO OCCUPIED ---');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('status', 'occupied');

    if (tablesError) throw tablesError;
    tables.forEach(t => {
      console.log(`Mesa ID: ${t.id} | Número: ${t.number} | Estado: ${t.status}`);
    });

  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();
