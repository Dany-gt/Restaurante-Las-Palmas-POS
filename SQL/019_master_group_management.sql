-- Agregar columnas a modifier_groups
ALTER TABLE modifier_groups 
ADD COLUMN IF NOT EXISTS min_selection INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_selection INT DEFAULT 1;

-- Asegurar columnas en option_groups
ALTER TABLE option_groups 
ADD COLUMN IF NOT EXISTS min_selection INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_selection INT DEFAULT 1;

-- Crear la tabla pivot central group_items
CREATE TABLE IF NOT EXISTS group_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    option_group_id UUID REFERENCES option_groups(id) ON DELETE CASCADE,
    modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    extra_price DECIMAL(10,2) DEFAULT 0.00,
    modifier_type VARCHAR(10) DEFAULT 'add', -- 'add' o 'remove'
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_group_type CHECK (
        (option_group_id IS NOT NULL AND modifier_group_id IS NULL) OR 
        (option_group_id IS NULL AND modifier_group_id IS NOT NULL)
    )
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_group_items_op_grp ON group_items(option_group_id);
CREATE INDEX IF NOT EXISTS idx_group_items_mod_grp ON group_items(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_group_items_prod ON group_items(product_id);
