-- Tabla principal de auditoría detallada
CREATE TABLE IF NOT EXISTS activity_log_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  
  -- Usuario
  usuario_id TEXT,
  usuario_nombre TEXT,
  usuario_rol TEXT,
  usuario_ip TEXT,
  usuario_dispositivo TEXT,
  usuario_url_actual TEXT,
  sesion_id TEXT,
  
  -- Evento
  modulo TEXT NOT NULL,
  sub_modulo TEXT,
  accion TEXT NOT NULL,
  accion_descripcion TEXT NOT NULL,
  
  -- Entidad afectada
  entidad_tipo TEXT,
  entidad_id TEXT,
  entidad_nombre TEXT,
  
  -- Cambios
  valores_anteriores JSONB,
  valores_nuevos JSONB,
  campos_modificados TEXT[],
  
  -- Impacto financiero
  impacto_financiero JSONB,
  
  -- Reversibilidad
  es_reversible BOOLEAN DEFAULT false,
  datos_para_revertir JSONB,
  fue_revertido BOOLEAN DEFAULT false,
  revertido_por TEXT,
  revertido_fecha TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  request_id TEXT,
  duracion_accion_ms INTEGER,
  
  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  timestamp_local TEXT,
  
  -- Este registro NO puede modificarse ni eliminarse
  -- Solo INSERT permitido via RLS
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Política RLS: solo INSERT, nunca UPDATE ni DELETE
ALTER TABLE activity_log_detailed 
  ENABLE ROW LEVEL SECURITY;

-- Drop if exists to avoid errors on multiple runs
DROP POLICY IF EXISTS "Solo insertar auditoria" ON activity_log_detailed;
CREATE POLICY "Solo insertar auditoria" 
  ON activity_log_detailed
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Solo lectura auditoria autenticados" ON activity_log_detailed;
CREATE POLICY "Solo lectura auditoria autenticados"
  ON activity_log_detailed
  FOR SELECT USING (true); -- Set to true for local dev, can be restricted later

-- ÍNDICES para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_usuario
  ON activity_log_detailed(usuario_nombre);
CREATE INDEX IF NOT EXISTS idx_audit_modulo
  ON activity_log_detailed(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_accion
  ON activity_log_detailed(accion);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON activity_log_detailed(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidad
  ON activity_log_detailed(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audit_sesion
  ON activity_log_detailed(sesion_id);

-- Vista para el módulo de historial
CREATE OR REPLACE VIEW v_activity_log AS
SELECT
  id,
  timestamp,
  timestamp_local,
  usuario_nombre,
  usuario_rol,
  usuario_ip,
  usuario_dispositivo,
  modulo,
  sub_modulo,
  accion,
  accion_descripcion,
  entidad_tipo,
  entidad_nombre,
  campos_modificados,
  valores_anteriores,
  valores_nuevos,
  impacto_financiero,
  es_reversible,
  fue_revertido
FROM activity_log_detailed
ORDER BY timestamp DESC;
