
-- Función para verificar si un producto requiere configuración detallada (Opciones o Modificadores)
-- Retorna TRUE si tiene grupos asociados, FALSE si es un producto simple.

CREATE OR REPLACE FUNCTION check_if_customizable(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_options BOOLEAN;
    has_modifiers BOOLEAN;
BEGIN
    -- Verificar en la tabla de relación de grupos de opciones
    SELECT EXISTS (
        SELECT 1 FROM product_option_groups WHERE product_id = p_id
    ) INTO has_options;

    -- Si ya encontramos opciones, no hace falta buscar modificadores
    IF has_options THEN
        RETURN TRUE;
    END IF;

    -- Verificar en la tabla de relación de grupos de modificadores
    SELECT EXISTS (
        SELECT 1 FROM product_modifier_groups WHERE product_id = p_id
    ) INTO has_modifiers;

    RETURN has_modifiers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
