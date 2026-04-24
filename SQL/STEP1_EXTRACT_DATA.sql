-- ============================================
-- PASO 1: EXTRAER DATOS EXISTENTES DE SUPABASE
-- Ejecuta cada consulta y exporta como CSV
-- ============================================

-- Ejecuta cada SELECT en el SQL Editor de Supabase
-- Luego haz clic en "Export" -> "CSV" para descargar cada tabla

-- 1. PROFILES (usuarios)
SELECT * FROM profiles;

-- 2. ROLES
SELECT * FROM roles;

-- 3. SECTIONS (zonas)
SELECT * FROM sections;

-- 4. TABLES (mesas)
SELECT * FROM tables;

-- 5. KITCHEN_STATIONS (estaciones de cocina)
SELECT * FROM kitchen_stations;

-- 6. CATEGORIES (categorías)
SELECT * FROM categories;

-- 7. PRODUCTS (productos)
SELECT * FROM products;

-- 8. CASH_REGISTERS (cajas registradoras)
SELECT * FROM cash_registers;

-- 9. SYSTEM_SETTINGS (configuración)
SELECT * FROM system_settings;

-- 10. SUPPLIERS (proveedores)
SELECT * FROM suppliers;

-- 11. INVENTORY_ITEMS (inventario)
SELECT * FROM inventory_items;

-- 12. ORDERS (órdenes - puede ser mucha data)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000;

-- 13. ORDER_ITEMS (items de órdenes)
SELECT * FROM order_items;

-- 14. EXPENSES (gastos)
SELECT * FROM expenses;

-- 15. INVOICES (facturas)
SELECT * FROM invoices;

-- 16. SHIFTS (turnos de caja) - Esta es la tabla que ya tienes
SELECT * FROM shifts;
