
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: No se encontraron las credenciales de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
  'profiles', 'tables', 'categories', 'products', 'orders', 'order_items', 
  'invoices', 'customers', 'inventory_items', 'system_settings', 'sections', 
  'product_categories', 'menu_categories', 'roles', 'product_branch_prices', 
  'product_branch_inventory', 'inventory_item_branches', 'expenses', 'shifts', 
  'activity_log', 'cash_drawer_logs', 'printers', 'kitchen_stations', 
  'modifiers', 'product_modifiers', 'inventory_transactions', 'suppliers'
];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.resolve(__dirname, `supabase_backup_${timestamp}.sql`);
  let sqlContent = `-- Respaldo de Supabase - ${new Date().toLocaleString()}\n`;
  sqlContent += `-- URL: ${SUPABASE_URL}\n\n`;

  console.log(`Iniciando respaldo en: ${backupFile}`);

  for (const table of tables) {
    console.log(`Procesando tabla: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');

    if (error) {
      console.error(`Error en tabla ${table}:`, error.message);
      sqlContent += `-- Error en tabla ${table}: ${error.message}\n\n`;
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`Tabla ${table} está vacía.`);
      sqlContent += `-- Tabla ${table} está vacía.\n\n`;
      continue;
    }

    sqlContent += `-- Datos de la tabla: ${table}\n`;
    
    // Generar INSERTs
    for (const row of data) {
      const keys = Object.keys(row);
      const values = keys.map(k => {
        const val = row[k];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });

      sqlContent += `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    sqlContent += '\n';
  }

  fs.writeFileSync(backupFile, sqlContent);
  console.log(`\n¡Respaldo completado exitosamente!`);
  console.log(`Archivo generado: ${backupFile}`);
}

backup().catch(console.error);
