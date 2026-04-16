-- Añadir límites de selección dinámica a la relación platillo -> grupo de opciones
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 0;

-- Añadir límites de selección dinámica a la relación platillo -> grupo de modificadores
ALTER TABLE public.product_modifier_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.product_modifier_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 0;

-- NOTA: El valor 0 en max_selection significa "Sin Límite" a nivel de UI para los modificadores,
-- o bien el límite será interpretado directamente por la lógica de negocio al no tener una restricción superior estricta.
