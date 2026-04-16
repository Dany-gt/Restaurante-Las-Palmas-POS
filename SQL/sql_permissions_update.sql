-- ============================================
-- ADICIONES PARA ROLES Y PERMISOS
-- RESTAURANTE LAS PALMAS POS
-- ============================================

-- 1. TABLA DE LOGS DE ACTIVIDAD
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. FUNCIÓN PARA VERIFICAR PERMISOS
-- Esta función permite verificar si un usuario tiene un permiso específico
CREATE OR REPLACE FUNCTION check_user_permission(user_id_param UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN;
BEGIN
    SELECT 
        (r.permissions ? permission_name) OR (p.role = 'ADMIN')
    INTO has_perm
    FROM profiles p
    LEFT JOIN roles r ON p.role_id = r.id
    WHERE p.id = user_id_param;
    
    RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. INSERTAR ROLES POR DEFECTO SI NO EXISTEN
-- Nota: Las IDs son aleatorias, se recomienda usar los nombres para buscar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ADMINISTRADOR') THEN
        INSERT INTO roles (name, description, permissions) 
        VALUES ('ADMINISTRADOR', 'Acceso total al sistema', '[]'); -- Admin se maneja por hardcode en la función o llenando todos los perms
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'SUPERVISOR') THEN
        INSERT INTO roles (name, description, permissions) 
        VALUES ('SUPERVISOR', 'Gestión operativa y reportes', '["Cajero:Anular Facturas", "Cajero:Aplicar Descuentos", "Reportes:Acceso"]');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'CAJERO') THEN
        INSERT INTO roles (name, description, permissions) 
        VALUES ('CAJERO', 'Operaciones de caja y ventas', '["Cajero:Acceder a Corte de Caja", "Cajas:Acceso"]');
    END IF;
END $$;

-- 4. ACTUALIZAR PROFILES PARA SOPORTAR ÚLTIMOS CAMBIOS (si faltan columnas)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_login') THEN
        ALTER TABLE profiles ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
