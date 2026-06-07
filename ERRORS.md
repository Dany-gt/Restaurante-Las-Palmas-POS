## [2026-06-03 14:45] - Error de Ejecución al Modificar ReportCaja.tsx

- **Type**: Agent
- **Severity**: High
- **File**: `components/admin/ReportCaja.tsx`
- **Agent**: AntiGravity (Orchestrator/Frontend)
- **Root Cause**: Al intentar reemplazar código usando `multi_replace_file_content` para ajustar el `tfoot`, el contexto de reemplazo hizo match con la zona equivocada y borró accidentalmente el cierre de la tabla y componentes anidados (Execution Error).
- **Error Message**: 
  ```
  El reemplazo borró líneas críticas (473-500) en lugar de solo actualizar el tfoot, rompiendo la estructura de la tabla.
  ```
- **Fix Applied**: El usuario revirtió el cambio mediante Git/undo inmediatamente.
- **Prevention**: Utilizar `replace_file_content` con bloques mucho más específicos y probar los cambios localmente en componentes críticos antes de inyectar CSS o cambiar estructuras completas. Respetar el ciclo PDCA rigurosamente.
- **Status**: Fixed

---

## [2026-06-06 17:00] - Inconsistencia de Ordenamiento y Visualización en Cuentas (Múltiples Cuentas)

- **Type**: Logic
- **Severity**: High
- **File**: `components/OrderView.tsx` y `components/AccountsOverviewModal.tsx`
- **Agent**: AntiGravity
- **Root Cause**: 
  1. Al crear Cuenta 1 y Cuenta 2 juntas, compartían exactamente el mismo timestamp `created_at`. Al recuperarlas de Supabase, Postgres las devolvía en orden no determinista, lo que hacía que sus índices en `tableOrders` se intercambiaran aleatoriamente. Esto provocaba que los badges (`C1`, `C2`, `C3`) y nombres de cuentas dinámicos en el modal se cruzaran o mostraran información en blanco.
  2. El botón de ordenar principal tenía una guarda que impedía enviar todas las cuentas a cocina si el usuario estaba en la pestaña global "Todas las cuentas" o si el tab activo no tenía productos temporales, bloqueando el envío agrupado.
- **Error Message**: N/A (Fallo lógico visual/funcional)
- **Fix Applied**: 
  1. Se agregó un desfase de 1000ms a la creación de la Cuenta 2 para asegurar timestamps secuenciales.
  2. Se implementó un ordenamiento determinista en `fetchData` por `created_at` (ascendente) y luego por `customer_name` (ascendente numérico).
  3. Se corrigió la lógica de guarda del botón submit usando una bandera de comprobación global `hasUnsentToSubmit` en lugar del tab activo aislado.
- **Prevention**: Garantizar siempre ordenamientos estables/deterministas en colecciones dinámicas y mapeos basados en índices de base de datos.
- **Status**: Fixed
