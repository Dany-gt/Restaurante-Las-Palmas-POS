# Módulo: Cuentas por Cobrar

## Descripción general
El módulo de Cuentas por Cobrar gestiona las líneas de crédito otorgadas a clientes corporativos u hoteles. Su propósito es permitir el cierre de ventas "AL CRÉDITO" en el POS, manteniendo un seguimiento riguroso de los saldos pendientes, límites de crédito autorizados y la aplicación de abonos o pagos posteriores para la liberación de saldo.

## Categorías
1. **Cartera de Clientes**: Registro de entidades con crédito autorizado.
2. **Transacciones de Crédito**: Cargos automáticos generados desde el POS.
3. **Gestión de Abonos**: Registro manual de pagos de clientes para reducir su deuda.
4. **Estados de Cuenta**: Reportes históricos de compras y pagos por cliente.

## Interacción con Base de Datos

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `customers` | Almacena los límites de crédito (`credit_limit`) y el saldo actual (`current_balance`). |
| `credit_transactions` | Registro histórico de cada movimiento (CARGO o ABONO). |
| `receivables_summary` | Vista consolidada para visualizar saldos vencidos y por vencer. |

### Relaciones Clave
- `credit_transactions.customer_id` → `customers.id`
- `credit_transactions.order_id` → `orders.id` (Solo para cargos provenientes de ventas)

### Consultas Principales
**Generación Automática de Cargo (Trigger en `orders`):**
```sql
INSERT INTO credit_transactions (customer_id, order_id, amount, type, description)
VALUES ('ID_CLIENTE', 'ID_ORDEN', 450.00, 'CHARGE', 'Compra según Orden #1234');
```

**Validación de Disponibilidad de Crédito:**
```sql
SELECT 
    (credit_limit - current_balance) as disponible
FROM customers
WHERE id = 'ID_CLIENTE';
```

---
*Documentación Técnica - Restaurante Las Palmas*
