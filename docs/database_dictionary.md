# Diccionario de Datos Maestro

Este documento consolida la estructura completa de la base de datos del sistema POS "Restaurante Las Palmas". Proporciona una referencia centralizada para desarrolladores y administradores sobre las tablas, columnas, tipos y relaciones que sustentan el sistema.

---

## 🏗️ Resumen de Arquitectura
El sistema utiliza **PostgreSQL** alojado en **Supabase**. La arquitectura está diseñada para ser multi-sucursal y multi-organización (SaaS-ready) mediante el uso de `org_id` y `branch_id`.

---

## 📁 Dominios de Datos

### 1. Núcleo: Seguridad y Perfiles
| Tabla | Descripción | Columnas Clave |
| :--- | :--- | :--- |
| `roles` | Grupos de permisos del sistema. | `name` (unique), `permissions` (jsonb) |
| `profiles` | Extensión de auth.users. | `role` (ADMIN, CAJERO, MESERO, COCINA), `pin` (char 4) |
| `branches` | Sucursales físicas. | `name`, `address`, `org_id` |

### 2. Catálogo Masivo: Productos e Inventarios
| Tabla | Descripción | Columnas Clave |
| :--- | :--- | :--- |
| `products` | Maestro unificado de Platillos e Insumos. | `es_platillo` (flag), `price`, `unit_measure`, `conversion_factor` |
| `menu_categories` | Categorías visuales para el POS. | `nombre`, `icono`, `sort_order` |
| `product_categories`| Clasificación para inventarios. | `nombre`, `tipo` (insumo/utensilio) |
| `product_branch_inventory` | Existencias por sucursal. | `product_id`, `branch_id`, `quantity`, `min_stock` |
| `product_recipes` | Composición de platillos. | `product_id`, `inventory_item_id`, `quantity` |

### 3. Operación POS: Ventas y Caja
| Tabla | Descripción | Columnas Clave |
| :--- | :--- | :--- |
| `orders` | Cabecera de órdenes/pedidos. | `status`, `total`, `payment_method`, `table_id` |
| `order_items` | Detalle de líneas de pedido. | `product_id`, `quantity`, `unit_price`, `subtotal` |
| `restaurant_tables` | Mobiliario físico. | `number`, `section`, `status` |
| `shifts` | Control de turnos y arqueos. | `starting_balance`, `cash_sales`, `total_expected` |
| `cash_registers` | Definición de cajas físicas. | `name`, `is_active` |

### 4. Contabilidad y Créditos
| Tabla | Descripción | Columnas Clave |
| :--- | :--- | :--- |
| `historico_auditoria_sat` | Repositorio de DTEs de la SAT. | `fel_uuid`, `tipo`, `monto_total`, `iva_monto`, `items` (jsonb) |
| `purchase_invoices` | Compras a proveedores. | `supplier_name`, `invoice_date`, `status` |
| `customers` | Registro de clientes (incluye créditos). | `credit_limit`, `current_balance`, `authorized_discount` |
| `credit_transactions` | Libro mayor de créditos. | `type` (CHARGE/PAYMENT), `amount`, `customer_id` |
| `payroll_employees` | Datos salariales de empleados. | `base_salary`, `position`, `department` |

---

## 🛠️ Especificaciones Técnicas Detalladas

### Tabla: `products`
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Clave Primaria. |
| `es_platillo` | BOOLEAN | `true` para menú de venta, `false` para inventario. |
| `name` | TEXT | Nombre comercial del ítem. |
| `price` | NUMERIC(10,2) | Precio de venta global. |
| `cost_price` | NUMERIC(10,2) | Costo de adquisición o costo teórico. |
| `unit_measure` | TEXT | Unidad base (lb, kg, lt, uni). |
| `conversion_factor` | NUMERIC | Factor para convertir unidad de compra a porción. |

### Tabla: `orders`
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID | Clave Primaria. |
| `status` | TEXT | `pending`, `preparing`, `ready`, `completed`, `cancelled`. |
| `payment_method` | TEXT | `efectivo`, `tarjeta`, `AL CRÉDITO`. |
| `total` | NUMERIC(14,2) | Monto final cobrado (incluye impuestos). |
| `table_id` | TEXT | Referencia a la mesa física. |

---

## 🔌 Vistas y Funciones Especiales

### Vistas Críticas
- **`receivables_summary`**: Consolida deudas de clientes extrayendo datos de `customers` y `credit_transactions`.
- **`inventory_stock_alerts`**: Resaltan ítems con `quantity <= min_stock`.

### Triggers Inteligentes
- **`register_credit_sale_v2`**: Se dispara tras un `INSERT` en `orders` cuando el pago es a crédito para crear el cargo financiero.
- **`deduct_inventory_on_sale`**: Disminuye el stock de la sucursal basado en la receta configurada del platillo vendido.

---

## 🚀 Recuperación de Desastres y Migración

Para recrear esta base de datos en un entorno nuevo de Supabase, se ha consolidado un script maestro:

**Archivo Maestro**: [`FULL_SYSTEM_RECOVERY_SCHEMA.sql`](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/SQL/FULL_SYSTEM_RECOVERY_SCHEMA.sql)

Este script garantiza:
1. Creación de tablas en el orden correcto (resolución de Foreign Keys).
2. Inicialización de extensiones necesarias.
3. Creación de vistas y lógica de negocio.
4. Definición base de políticas de seguridad.

---
*Este Diccionario de Datos es dinámico y refleja la versión v2.5 del sistema al 28 de abril de 2026.*
