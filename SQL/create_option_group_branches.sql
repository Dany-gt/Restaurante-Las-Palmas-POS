CREATE TABLE IF NOT EXISTS public.option_group_branches (
    option_group_id UUID REFERENCES public.option_groups(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    is_assigned BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (option_group_id, branch_id)
);

-- Habilitar RLS (Seguridad de Nivel de Fila)
ALTER TABLE public.option_group_branches ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir lectura/escritura a usuarios autenticados
CREATE POLICY "Permitir lectura a todos" ON public.option_group_branches FOR SELECT USING (true);
CREATE POLICY "Permitir inserción" ON public.option_group_branches FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización" ON public.option_group_branches FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación" ON public.option_group_branches FOR DELETE USING (true);

-- Insertar valores por defecto para los grupos existentes
INSERT INTO public.option_group_branches (option_group_id, branch_id, is_enabled, is_assigned)
SELECT o.id, b.id, true, true
FROM public.option_groups o
CROSS JOIN public.branches b
ON CONFLICT (option_group_id, branch_id) DO NOTHING;
