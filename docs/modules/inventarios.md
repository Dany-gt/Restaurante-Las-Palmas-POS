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
## Descripción general
El módulo de Inventarios es el núcleo del control de recursos del restaurante. Su propósito es centralizar la gestión de materias primas (insumos) y activos operativos (utensilios), asegurando que el flujo de existencias sea trazable desde la compra hasta el consumo final en recetas o desperdicio. Operativamente, permite el monitoreo de niveles críticos y la realización de auditorías físicas para prevenir mermas.

## Categorías
El módulo se divide en dos grandes dominios de datos:
1. **Insumos (Consumibles)**: Productos que forman parte de la transformación culinaria (ej. Harina, Carne, Vegetales).
2. **Utensilios (Activos)**: Elementos necesarios para la operación que no se consumen directamente (ej. Platos, Cubiertos, Cristalería).
3. **Kardex**: Registro histórico de movimientos (entradas, salidas, ajustes).
4. **Auditorías de Existencia**: Procesos de conteo físico vs. saldo en sistema.

## Interacción con Base de Datos

El sistema utiliza un esquema unificado dentro de la tabla `products`, diferenciando los elementos de inventario mediante la bandera `es_platillo = false`.

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `products` | Almacena los ítems maestros (insumos/utensilios). Campos clave: `unit_measure`, `conversion_factor`, `cost_price`. |
| `product_categories` | Clasificación lógica exclusiva para inventarios. |
| `product_branch_inventory` | Multisitio: Controla la cantidad (stock) y el stock mínimo por cada sucursal (`branch_id`). |
| `inventory_movements` | Registro de cada transacción de inventario para fines de Kardex. |
| `physical_counts` | Cabecera de auditorías físicas. |
| `physical_count_items` | Detalle del conteo por ítem durante la auditoría. |

### Relaciones Clave
- `products.product_category_id` → `product_categories.id` (Relación 1:N)
- `product_branch_inventory.product_id` → `products.id` (Relación M:N entre productos y sucursales)

### Consultas Principales
**Obtención de Existencias por Sucursal:**
```sql
SELECT 
    p.name, 
    p.unit_measure, 
    i.quantity, 
    i.min_stock
FROM products p
JOIN product_branch_inventory i ON p.id = i.product_id
WHERE i.branch_id = 'BRANCH_ID' AND p.es_platillo = false;
```

**Registro de Movimiento en Kardex:**
```sql
INSERT INTO inventory_movements (product_id, branch_id, type, quantity, reason)
VALUES ('ID_PROD', 'ID_BRANCH', 'ENTRY', 10, 'Compra a proveedor');
```

---
*Documentación Técnica - Restaurante Las Palmas*
