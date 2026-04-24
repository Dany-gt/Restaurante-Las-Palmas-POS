-- DROP TABLE IF EXISTS cost_items;
-- DROP TABLE IF EXISTS cost_control_config;

-- CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS cost_control_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT DEFAULT 'default' UNIQUE,
    monthly_sales NUMERIC DEFAULT 275000,
    operating_days INTEGER DEFAULT 26,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COST ITEMS TABLE
CREATE TABLE IF NOT EXISTS cost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT DEFAULT 'default',
    section TEXT, -- 'raw_material' | 'mod' | 'fixed' | 'variable'
    description TEXT,
    amount NUMERIC DEFAULT 0,
    persons INTEGER DEFAULT 1, -- used for MOD
    base_salary NUMERIC DEFAULT 0, -- used for MOD
    benefits_pct NUMERIC DEFAULT 47.67, -- used for MOD
    sort_order INTEGER DEFAULT 0,
    is_deletable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INITIAL CONFIG
INSERT INTO cost_control_config (org_id, monthly_sales, operating_days)
VALUES ('default', 275000, 26)
ON CONFLICT (org_id) DO NOTHING;

-- INITIAL DATA - MATERIA PRIMA (RAW MATERIAL)
INSERT INTO cost_items (section, description, amount, sort_order, is_deletable) VALUES
('raw_material', 'Materia prima cocina', 0, 1, false),
('raw_material', 'Materia prima cevichería', 0, 2, false),
('raw_material', 'Materia prima bebidas', 0, 3, false),
('raw_material', 'Otros insumos directos', 0, 4, false);

-- INITIAL DATA - MANO DE OBRA DIRECTA (MOD)
INSERT INTO cost_items (section, description, persons, base_salary, benefits_pct, sort_order, is_deletable) VALUES
('mod', 'Cocineras', 5, 3816.90, 47.67, 1, false),
('mod', 'Preparador', 1, 3816.90, 47.67, 2, false),
('mod', 'Cevicheros', 2, 3816.90, 47.67, 3, false);

-- INITIAL DATA - GASTOS FIJOS (FIXED EXPENSES)
INSERT INTO cost_items (section, description, amount, sort_order) VALUES
('fixed', 'Planilla meseros (5 con prestaciones)', 19084.50, 1),
('fixed', 'Planilla admin / aux (Danilo)', 3816.90, 2),
('fixed', 'Planilla limpieza / jardinero', 3816.90, 3),
('fixed', 'Alquiler del local', 11788.10, 4),
('fixed', 'Energía eléctrica', 2876.00, 5),
('fixed', 'Agua potable', 180.00, 6),
('fixed', 'Internet y telefonía (Tigo + Claro)', 463.00, 7),
('fixed', 'Prohigiene', 991.67, 8),
('fixed', 'Extracción de basura', 20.00, 9),
('fixed', 'Mantenimiento extractores', 733.33, 10),
('fixed', 'Mantenimiento A/C', 600.00, 11),
('fixed', 'Servicio agua potable adicional', 180.00, 12),
('fixed', 'Pago de contador', 1000.00, 13),
('fixed', 'Paladar (sistema)', 300.00, 14),
('fixed', 'Seguridad Goian', 295.00, 15),
('fixed', 'SKY', 199.00, 16),
('fixed', 'Tigo Residencial', 244.00, 17),
('fixed', 'IRTRA / otros patronales', 343.52, 18),
('fixed', 'INTECAP', 343.52, 19);

-- INITIAL DATA - GASTOS VARIABLES (VARIABLE EXPENSES)
INSERT INTO cost_items (section, description, amount, sort_order) VALUES
('variable', 'Combustible y gas propano', 4500.00, 1),
('variable', 'Energía eléctrica variable', 2876.00, 2),
('variable', 'Artículos de limpieza', 1405.32, 3),
('variable', 'Desechables', 1500.00, 4),
('variable', 'Rollos para impresora', 158.33, 5),
('variable', 'Combustible vehículo / Corsa', 1500.00, 6),
('variable', 'Transporte', 300.00, 7),
('variable', 'Fumigación', 620.00, 8),
('variable', 'Papelería de oficina', 50.00, 9),
('variable', 'Adornos / decoración', 200.00, 10),
('variable', 'Mantenimiento establecimiento', 3000.00, 11),
('variable', 'Horas extras (variable)', 0, 12),
('variable', 'Repuestos mantenimiento A/C', 0, 13);
