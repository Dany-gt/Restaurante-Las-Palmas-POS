# Módulo: Contabilidad & SAT

## Descripción general
Este módulo gestiona la salud financiera y el cumplimiento fiscal del restaurante. Su objetivo principal es automatizar la conciliación de documentos tributarios electrónicos (DTE) mediante la sincronización directa con el portal de la SAT, administrar los egresos operativos y consolidar la información para libros contables y declaraciones de impuestos.

## Categorías
1. **Sincronización SAT**: Mapeo automático de Facturas de Ventas (Emitidas) y Gastos/Compras (Recibidas).
2. **Clasificación Contable**: Asignación de categorías de gasto (ej. Alquileres, Servicios, Mercadería) a cada factura recibida.
3. **Control de Egresos**: Registro de gastos menores (caja chica) y compras a proveedores.
4. **Planilla de Empleados**: Gestión de nómina, bonificaciones y deducciones de ley.
5. **Impuestos (IVA/ISR)**: Generación de reportes para declaración mensual.

## Interacción con Base de Datos

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `purchase_invoices` | Histórico de facturas de proveedores (Compras). |
| `sales_invoices` | Histórico de facturas enviadas a clientes (Ventas). |
| `historico_auditoria_sat` | Tabla de auditoría detallada de todos los DTE descargados. |
| `journal_entries` | Asientos contables para doble partida (Debe/Haber). |
| `payroll_records` | Registros de salarios devengados y deducciones. |

### Relaciones Clave
- `historico_auditoria_sat.fel_uuid` es la llave única para evitar duplicados.
- `purchase_invoices.supplier_nit` → `suppliers.nit`

### Consultas Principales
**Sincronización con Resolución de Conflictos (PostgreSQL UPSERT):**
```sql
INSERT INTO purchase_invoices (fel_uuid, invoice_date, supplier_name, total_amount, description)
VALUES ('UUID-FACTURA', '2026-04-28', 'Proveedor S.A.', 1500.00, 'Compra de Insumos')
ON CONFLICT (fel_uuid) DO NOTHING;
```

**Resumen Mensual de IVA por Pagar:**
```sql
SELECT 
    sum(iva_amount) FILTER (WHERE tipo = 'venta') as iva_debito,
    sum(iva_amount) FILTER (WHERE tipo = 'compra') as iva_credito,
    (sum(iva_amount) FILTER (WHERE tipo = 'venta') - sum(iva_amount) FILTER (WHERE tipo = 'compra')) as neto_iva
FROM historico_auditoria_sat
WHERE status = 'paid' AND fecha_emision >= '2026-04-01';
```

---
*Documentación Técnica - Restaurante Las Palmas*
