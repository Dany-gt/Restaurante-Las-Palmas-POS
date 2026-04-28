# Módulo: Ventas / POS (Point of Sale)

Este módulo es el corazón operativo del restaurante, permitiendo la toma de pedidos, gestión de mesas, servicio a domicilio y el control de caja.

## Categorías y Flujos de Trabajo

### 1. Terminal de Ventas (POS)
Interfaz optimizada para la toma rápida de pedidos:
- **Salón / Mesas**: Gestión visual de mesas por zonas (Secciones). Permite abrir cuentas, agregar items y dividir cuentas.
- **Servicio a Domicilio (Delivery)**: Gestión de clientes, múltiples direcciones y asignación de motoristas.
- **Venta Rápida (Mostrador)**: Flujo simplificado para pedidos de "Para llevar" o consumo inmediato.

### 2. Gestión de Órdenes
- **Ciclo de Vida**: Pendiente -> Preparando -> Listo -> Servido -> Pagado.
- **Preparación (KDS/Impresión)**: Envío automático de comandas a las estaciones correspondientes (Cocina, Bar, etc.).
- **Correlativos**: Generación de números de orden transaccionales correlativos sin saltos.

### 3. Control de Caja y Turnos
- **Apertura de Turno**: Registro del fondo inicial.
- **Arqueo y Cierre**: Conciliación de ventas por método de pago (Efectivo, Tarjeta).
- **Gastos de Caja**: Registro de salidas de efectivo justificadas durante el turno.
- **Reporte Z**: Resumen final detallado del movimiento diario.

### 4. Servicio a Domicilio y Motoristas
- Catálogo de motoristas con estado (Activo/Inactivo).
- Trazabilidad de tiempos de entrega.
- Registro de direcciones detalladas con referencias y coordenadas.

## Esquema SQL (Tablas Principales)

### `orders`
Cabecera de la transacción de venta.
- `order_number`: Correlativo único de orden.
- `status`: Estado actual.
- `total`, `tax_amount`, `tip_amount`.
- `payment_method`: Efectivo, Tarjeta, Crédito.
- `driver_id`: UUID del motorista asignado.

### `order_items`
Detalle de productos en cada orden.
- `product_id`, `quantity`, `unit_price`.
- `status`: Estado de preparación ('pending', 'ready', etc.).

### `shifts`
Control de turnos de caja.
- `opening_amount`, `closing_amount`, `counted_amount`.
- `cash_detail`: desglose de billetes y monedas.

### `cash_registers`
Definición física de las cajas del local.

### `delivery_drivers`
Registro de personal de reparto.

---
*Documentación generada automáticamente como backup del sistema.*
