-- Función para verificar eficientemente si un producto tiene opciones o modificadores
-- Esto se utilizará para saltar el modal de personalización en el POS para productos simples
CREATE OR REPLACE FUNCTION check_if_customizable(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_options BOOLEAN;
    has_modifiers BOOLEAN;
    has_master_options BOOLEAN;
    has_master_modifiers BOOLEAN;
BEGIN
    -- Revisar tablas pivote de master groups management
    SELECT EXISTS (
        SELECT 1 FROM group_items 
        WHERE product_id = p_id AND is_enabled = true AND option_group_id IS NOT NULL
    ) INTO has_master_options;

    SELECT EXISTS (
        SELECT 1 FROM group_items 
        WHERE product_id = p_id AND is_enabled = true AND modifier_group_id IS NOT NULL
    ) INTO has_master_modifiers;

    -- Revisar las tablas originales por herencia estructural (si aplica en el sistema)
    SELECT EXISTS (
        SELECT 1 FROM product_option_groups 
        WHERE product_id = p_id
    ) INTO has_options;

    SELECT EXISTS (
        SELECT 1 FROM product_modifier_groups 
        WHERE product_id = p_id
    ) INTO has_modifiers;

    -- Si cualquiera es verdadera, el producto es configurable
    RETURN (has_options OR has_modifiers OR has_master_options OR has_master_modifiers);
END;
$$;
