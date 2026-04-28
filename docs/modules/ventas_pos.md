# Módulo: Ventas POS

## Descripción general
El módulo de Ventas (Punto de Venta) es el centro transaccional del restaurante. Su propósito es capturar las órdenes de los clientes de manera eficiente, coordinar la preparación con cocina (KDS) y gestionar el proceso de pago. Soporta múltiples modalidades de servicio (Mesa, Delivery, Para Llevar) y garantiza la integridad del flujo de dinero mediante arqueos de caja y turnos.

## Categorías
1. **Terminal de Ventas**: Interfaz táctil para la toma de pedidos rápida.
2. **Control de Mesas**: Mapa visual del restaurante para el seguimiento del consumo en salón.
3. **Delivery y Motoristas**: Gestión de pedidos a domicilio, asignación de pilotos y rastreo de estados de entrega.
4. **Cajas y Turnos**: Apertura, movimientos de efectivo y cierres (arqueos) de caja por usuario.
5. **Facturación**: Integración con el motor de emisión de facturas (DTE).

## Interacción con Base de Datos

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `orders` | Cabecera de la transacción. Campos: `status`, `total`, `table_id`, `waiter_id`, `delivery_id`. |
| `order_items` | Detalle del pedido. Líneas con `product_id`, `quantity` y `unit_price`. |
| `restaurant_tables` | Registro de mesas físicas y sus estados (Libre, Ocupada, Reservada). |
| `shifts` | Control de turnos (apertura y cierre de caja). |
| `delivery_drivers` | Listado de pilotos con estado de disponibilidad. |

### Relaciones Clave
- `orders.id` → `order_items.order_id` (Relación 1:N)
- `orders.branch_id` → `branches.id`
- `order_items.product_id` → `products.id`

### Consultas Principales
**Cálculo de Total de Venta por Turno:**
```sql
SELECT sum(total) 
FROM orders 
WHERE shift_id = 'ID_TURNO_ACTUAL' 
AND status = 'completed';
```

**Consulta de Mesas Ocupadas:**
```sql
SELECT t.number, t.status, o.total, o.created_at
FROM restaurant_tables t
LEFT JOIN orders o ON t.id = o.table_id AND o.status = 'open'
WHERE t.status = 'occupied';
```

---
*Documentación Técnica - Restaurante Las Palmas*
