-- ==============================================================================
-- SCRIPT: DATOS DE PRUEBA PARA CUENTAS POR COBRAR
-- ==============================================================================

BEGIN;

-- Insertar clientes de ejemplo con crédito autorizado
INSERT INTO public.customers (name, nit, phone, email, address, credit_limit, authorized_discount, current_balance)
VALUES 
    ('HOTEL LAS PALMAS'         , '12345678-9', '5555-1234', 'hotel@ejemplo.com', 'Zona 10', 5000.00,  5.0, 0.00),
    ('EMPRESA TEXTILES S.A.'    , '98765432-1', '4444-5555', 'textiles@ejemplo.com', 'Zona Industrial', 10000.00, 0.0, 1500.50),
    ('MUNICIPALIDAD DE ZONA 1'  , 'CF',         '2222-3333', 'muni@ejemplo.com', 'Centro Civico', 25000.00, 0.0, 0.00),
    ('CLIENTE VIP JUAN PEREZ'   , '11112222',   '5050-1010', 'juan@ejemplo.com', 'Colonia Las Rosas', 2000.00,  10.0, 450.00)
ON CONFLICT DO NOTHING;

-- Crear algunas transacciones de prueba para el cliente con saldo (EMPRESA TEXTILES)
DO $$
DECLARE
    v_customer_id UUID;
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_customer_id FROM public.customers WHERE name = 'EMPRESA TEXTILES S.A.' LIMIT 1;
    SELECT id INTO v_admin_id FROM public.profiles LIMIT 1; -- Usar cualquier usuario como creador

    IF v_customer_id IS NOT NULL THEN
        -- Cargo inicial
        INSERT INTO public.credit_transactions (customer_id, type, amount, description, created_by)
        VALUES (v_customer_id, 'CHARGE', 2000.00, 'Consumo Varios Alimentos', v_admin_id);
        
        -- Abono parcial
        INSERT INTO public.credit_transactions (customer_id, type, amount, description, created_by)
        VALUES (v_customer_id, 'PAYMENT', 499.50, 'Abono en Efectivo', v_admin_id);
    END IF;
END $$;

COMMIT;
