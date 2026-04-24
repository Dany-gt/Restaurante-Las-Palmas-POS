// ─── Migración: Crear tablas journal_entries + journal_lines ───────────────
// Ejecutar con: node scripts/migrate_journal_tables.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const SQL = `
CREATE TABLE IF NOT EXISTS journal_entries (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT         NOT NULL DEFAULT 'default',
  asiento_numero  INTEGER      NOT NULL,
  fecha           DATE         NOT NULL,
  descripcion     TEXT,
  tipo_asiento    TEXT,
  referencia      TEXT,
  creado_automatico BOOLEAN    DEFAULT true,
  periodo_mes     INTEGER      NOT NULL,
  periodo_anio    INTEGER      NOT NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID         NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  cuenta_codigo    TEXT         NOT NULL,
  cuenta_nombre    TEXT         NOT NULL,
  debe             NUMERIC(14,2) DEFAULT 0,
  haber            NUMERIC(14,2) DEFAULT 0,
  descripcion      TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_periodo  ON journal_entries(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_journal_fecha    ON journal_entries(fecha);
CREATE INDEX IF NOT EXISTS idx_journal_org      ON journal_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_lines_cuenta     ON journal_lines(cuenta_codigo);
CREATE INDEX IF NOT EXISTS idx_lines_entry      ON journal_lines(journal_entry_id);
`;

async function run() {
    console.log('⚙️  Creando tablas journal_entries y journal_lines...');
    const { error } = await supabase.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: { message: 'RPC no disponible' } }));

    if (error) {
        console.log('ℹ️  RPC no disponible. Ejecuta el SQL manualmente en Supabase Dashboard.');
        console.log('\n📋 SQL a ejecutar:\n');
        console.log(SQL);
    } else {
        console.log('✅ Tablas creadas exitosamente.');
    }
}

run();
