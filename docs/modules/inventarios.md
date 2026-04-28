# Módulo: Inventarios

Este módulo se encarga de la gestión integral de los recursos físicos del restaurante, divididos en Insumos (materia prima, desechables) y Utensilios (vajilla, equipo).

## Categorías Principales

El inventario se organiza en dos grandes tipos:
1. **Insumos**: Productos consumibles.
   - Desechables
   - Empaque para llevar
   - Limpieza
   - Cocina consumibles
   - Oficina y POS
2. **Utensilios**: Bienes duraderos.
   - Vajilla y Cristalería
   - Cubiertos
   - Utensilios de cocina
   - Equipos menores
   - Almacenamiento

## Funcionamiento

### Gestión de Stock
- **Stock Actual**: Control en tiempo real de las existencias.
- **Alertas**: El sistema genera alertas automáticas (Crítico, Bajo, Agotado) basadas en el stock mínimo configurado.
- **Días de Inventario**: Calcula automáticamente cuántos días de stock quedan basados en el consumo diario promedio.

### Movimientos de Inventario
Registra cada entrada y salida con:
- **Tipo**: Entrada, Salida, Ajuste, Baja, Conteo.
- **Motivo**: Compra, Uso, Pérdida, Rotura, Inventario Físico, etc.
- **Trazabilidad**: Registra responsable, fecha y permite adjuntar fotos de evidencia.

### Conteos Físicos
Permite realizar auditorías de inventario:
- Generación de hojas de conteo.
- Comparación automática entre "Sistema" vs "Contado".
- Ajuste automático de stock al aprobar el conteo.

## Esquema SQL (Tablas Principales)

### `inventory_categories`
Almacena las categorías de agrupación.
- `tipo`: 'insumo' o 'utensilio'.

### `inventory_items`
Tabla maestra de productos/utensilios.
- `codigo`: Código único (SKU).
- `stock_actual`, `stock_minimo`, `stock_maximo`.
- `cantidad_total`, `cantidad_en_uso`, `cantidad_bodega` (para utensilios).
- `unidad_medida`: kg, lt, unidad, etc.

### `inventory_movements`
Historial de transacciones de inventario.
- Relaciona `item_id` con el cambio en cantidad (`cantidad_anterior` -> `cantidad_nueva`).

### `physical_counts` y `physical_count_lines`
Control de auditorías físicas.

---
*Documentación generada automáticamente como backup del sistema.*
