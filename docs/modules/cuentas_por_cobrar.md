# Módulo: Cuentas por Cobrar

Este módulo permite la gestión de créditos otorgados a clientes corporativos u hoteles, facilitando el control de saldos pendientes y la aplicación de abonos.

## Categorías y Funcionalidad

### 1. Gestión de Clientes con Crédito
- **Límite de Crédito**: Monto máximo autorizado para compras al crédito por cliente.
- **Descuentos Autorizados**: Porcentaje de descuento automático aplicado a clientes frecuentes.
- **Saldo Actual**: Monitoreo en tiempo real del monto adeudado.

### 2. Transacciones de Crédito
- **Cargos (Charges)**: Generados automáticamente cuando una orden se cierra con el método de pago "AL CRÉDITO".
- **Abonos (Payments)**: Registros manuales de pagos realizados por el cliente para reducir su deuda.
- **Vistas Detalladas**: Historial completo de movimientos por cliente, incluyendo número de orden y descripción.

### 3. Automatización
- El sistema detecta cuando una orden es marcada como "AL CRÉDITO" y actualiza automáticamente el saldo del cliente asociado, registrando el cargo en la cuenta correspondiente.

## Esquema SQL (Tablas y Vistas)

### `receivables_summary` (Vista)
Une datos de clientes y transacciones para mostrar un resumen ejecutivo.
- `customer_name`, `limite_credito`, `saldo`.

### `credit_transactions`
Historial de movimientos financieros.
- `type`: 'CHARGE' (cargo) | 'PAYMENT' (abono).
- `amount`: Monto de la transacción.
- `order_id`: Referencia a la venta original (opcional).

### `customers` (Campos de Crédito)
Extensiones a la tabla de clientes.
- `credit_limit`.
- `current_balance`.
- `authorized_discount`.

---
*Documentación generada automáticamente como backup del sistema.*
