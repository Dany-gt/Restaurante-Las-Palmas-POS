-- 1. Crear tabla de unidades de medida con factores de conversión
CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Volumen, Masa, Conteo
    base_unit TEXT NOT NULL, -- La unidad mínima de referencia
    factor NUMERIC(15,5) NOT NULL DEFAULT 1.0, -- Factor para convertir a la unidad base
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Poblar con datos iniciales estandarizados
INSERT INTO public.inventory_units (code, name, category, base_unit, factor) VALUES
-- Volumen (Base: ML)
('ML', 'Mililitros', 'Volumen', 'ML', 1.0),
('LT', 'Litros', 'Volumen', 'ML', 1000.0),
('FL OZ', 'Onzas Líquidas', 'Volumen', 'ML', 29.5735),
('GL', 'Galones', 'Volumen', 'ML', 3785.41),

-- Masa (Base: GR)
('GR', 'Gramos', 'Masa', 'GR', 1.0),
('MG', 'Miligramos', 'Masa', 'GR', 0.001),
('KG', 'Kilogramos', 'Masa', 'GR', 1000.0),
('LB', 'Libras', 'Masa', 'GR', 453.592),
('OZ', 'Onzas', 'Masa', 'GR', 28.3495),

-- Conteo (Base: UN)
('UN', 'Unidades', 'Conteo', 'UN', 1.0),
('POR', 'Porciones', 'Conteo', 'UN', 1.0),
('CAJA', 'Cajas', 'Conteo', 'UN', 1.0),
('BOLSA', 'Bolsas', 'Conteo', 'UN', 1.0)
ON CONFLICT (code) DO UPDATE SET 
    factor = EXCLUDED.factor,
    base_unit = EXCLUDED.base_unit;

-- 3. Habilitar RLS
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read inventory_units" ON public.inventory_units;
CREATE POLICY "Allow public read inventory_units" ON public.inventory_units FOR SELECT TO public USING (true);

-- 4. Función de limpieza de unidad (para extraer códigos entre paréntesis como "Mililitro (ML)")
CREATE OR REPLACE FUNCTION public.clean_unit_code(p_unit TEXT)
RETURNS TEXT AS $$
DECLARE
    v_unit TEXT;
    v_matched TEXT;
BEGIN
    v_unit := TRIM(p_unit);
    -- Buscar texto entre paréntesis (ej: "Mililitro (ML)" -> "ML")
    v_matched := substring(v_unit from '\(([^)]+)\)');
    IF v_matched IS NOT NULL THEN
        RETURN UPPER(v_matched);
    END IF;
    RETURN UPPER(v_unit);
END;
$$ LANGUAGE plpgsql;

-- 5. Función para convertir entre cualquier par de unidades compatibles
CREATE OR REPLACE FUNCTION public.convert_inventory_unit(p_quantity NUMERIC, p_from_unit TEXT, p_to_unit TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_from_code TEXT;
    v_to_code TEXT;
    v_from_factor NUMERIC;
    v_to_factor NUMERIC;
    v_from_cat TEXT;
    v_to_cat TEXT;
BEGIN
    v_from_code := public.clean_unit_code(p_from_unit);
    v_to_code := public.clean_unit_code(p_to_unit);

    -- Obtener factores y categorías (busca por código o por nombre completo)
    SELECT factor, category INTO v_from_factor, v_from_cat 
    FROM public.inventory_units 
    WHERE code = v_from_code OR UPPER(name) = v_from_code OR UPPER(name) = UPPER(TRIM(p_from_unit));
    
    SELECT factor, category INTO v_to_factor, v_to_cat 
    FROM public.inventory_units 
    WHERE code = v_to_code OR UPPER(name) = v_to_code OR UPPER(name) = UPPER(TRIM(p_to_unit));

    -- Validaciones
    IF v_from_factor IS NULL OR v_to_factor IS NULL OR v_from_cat != v_to_cat THEN
        RETURN p_quantity; -- No se puede convertir, devolver original
    END IF;

    -- Cálculo: (Cantidad * Factor Origen) / Factor Destino
    RETURN (p_quantity * v_from_factor) / v_to_factor;
END;
$$ LANGUAGE plpgsql;

-- 6. Función de normalización (a unidad base)
CREATE OR REPLACE FUNCTION public.normalize_unit_quantity(p_quantity NUMERIC, p_unit_code TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_code TEXT;
    v_factor NUMERIC;
BEGIN
    v_code := public.clean_unit_code(p_unit_code);
    
    SELECT factor INTO v_factor 
    FROM public.inventory_units 
    WHERE code = v_code OR UPPER(name) = v_code OR UPPER(name) = UPPER(TRIM(p_unit_code));

    IF v_factor IS NULL THEN
        RETURN p_quantity;
    END IF;
    RETURN p_quantity * v_factor;
END;
$$ LANGUAGE plpgsql;
