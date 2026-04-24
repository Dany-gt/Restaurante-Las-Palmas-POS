-- Table for tracking activity logs (Audit Logs)
-- This table maintains a history of actions performed by system users

-- Ensure clean start (optional, but fixes schema mismatch errors)
-- DROP TABLE IF EXISTS public.activity_logs CASCADE;

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- User context
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    
    -- Multi-tenant context
    branch_id UUID, -- Sucursal donde ocurrió el evento
    org_id UUID,    -- Organización (para multi-empresa)
    
    -- Action context
    module TEXT NOT NULL, -- Sala, Caja, Admin, Inventario, etc.
    action TEXT NOT NULL, -- Acción específica (e.g., 'Anulación de Orden')
    
    -- Metadata
    details JSONB DEFAULT '{}'::jsonb, -- Metadatos dinámicos
    
    -- References (Ensure the types match and keys exist)
    CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_branch_id ON public.activity_logs (branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs (module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs (user_id);

-- RLS (Row Level Security)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent "already exists" errors during re-runs
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.activity_logs;

CREATE POLICY "Admins can view all logs" 
ON public.activity_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND (profiles.role = 'ADMIN' OR profiles.is_superadmin = true)
  )
);

CREATE POLICY "Anyone can insert logs" 
ON public.activity_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);
