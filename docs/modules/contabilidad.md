# Módulo: Contabilidad / SAT

Este módulo centraliza la operación financiera y el cumplimiento fiscal del restaurante, integrando directamente los datos del POS con los requerimientos de la SAT (Guatemala).

## Categorías y Funcionalidad

### 1. Auditoría SAT (DTE)
Sincronización robusta con la Agencia Virtual de la SAT para descargar y auditar Documentos Tributarios Electrónicos (DTE).
- **Recibidas (Compras)**: Análisis automático de facturas de proveedores, clasificación por rubro (Gasto, Activo, Costo) y detección de crédito fiscal.
- **Emitidas (Ventas)**: Verificación de facturas emitidas por el restaurante para asegurar que todo esté certificado y vigente.
- **Clasificación Automática**: El sistema utiliza lógica predefinida para asignar cuentas contables a proveedores recurrentes.

### 2. Gestión deIVA e ISR
- **IVA (Impuesto al Valor Agregado)**: Conciliación de Débito vs. Crédito fiscal. Generación de datos para la declaración mensual.
- **ISR (Impuesto Sobre la Renta)**: Cálculo proyectado sobre ingresos y retenciones aplicadas.

### 3. Libros Contables Formales
Generación de asientos contables bajo el sistema de partida doble:
- **Diario**: Registros automáticos de ventas diarias, compras y pagos de planilla.
- **Mayor**: Acumulados por cuenta contable para balances.

### 4. Planilla e IGSS
- Gestión de empleados y salarios base.
- Cálculo de bonificaciones, horas extras y retenciones de ley (IGSS, ISR asalariados).
- Historial de pagos quincenales.

### 5. Flujo de Caja y Conciliación
- Control de entradas (ventas, depósitos) y salidas (gastos, pagos).
- **Conciliación Bancaria**: Comparación entre registros del sistema y estados de cuenta bancarios (BI, BAC, etc.).

## Esquema SQL (Tablas Principales)

### `historico_auditoria_sat`
Tabla maestra de facturación electrónica.
- `uuid_dte`: Identificador único de la SAT.
- `monto_total`, `iva_credito_fiscal`.
- `clasificacion_compra`: 'GASTO', 'COSTO', 'ACTIVO_FIJO'.

### `payroll_employees` y `payroll_quincena_records`
Gestión de recursos humanos y pagos quincenales.

### `tax_declarations`
Registro de cumplimiento tributario.
- `tax_type`: 'IVA', 'ISR', 'IGSS'.
- `status`: 'pending' | 'paid'.

### `journal_entries` y `journal_lines`
Sistema central de contabilidad formal (Partidas).

### `cash_flow`
Registro diario de movimientos de liquidez.

---
*Documentación generada automáticamente como backup del sistema.*
