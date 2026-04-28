# Módulo: Menú de Platillos

Este módulo permite la administración de la oferta gastronómica del restaurante, gestionando desde la estructura de categorías hasta la complejidad de las recetas y personalizaciones.

## Categorías y Organización

El menú se estructura de la siguiente forma:
- **Categorías**: Agrupaciones lógicas de productos (ej. Entradas, Platos Fuertes, Bebidas, Postres).
- **Sub-Categorías**: Permite una jerarquía más profunda para menús extensos.
- **Orden de Visualización**: Control total sobre el índice de aparición en el POS.

## Descripción general
El módulo de Menú de Platillos gestiona la oferta comercial del restaurante. Su propósito es definir los productos finales que están disponibles para la venta en el POS, integrando la configuración estética (imágenes/categorías) con la lógica operativa (estaciones de cocina) y técnica (recetas para descarga automática de inventario).

## Categorías
1. **Listado de Platillos**: Catálogo maestro de productos finales (ej. Hamburguesa, Soda, Combo Familiar).
2. **Opciones y Modificadores**: Personalización de platillos (ej. Término de carne, extras de queso, cambios de guarnición).
3. **Categorías de Menú**: Organización visual para el POS (ej. Desayunos, Almuerzos, Bebidas).
4. **Recetas Técnicas**: Listado de insumos vinculados para descuento de stock automático al realizar una venta.
5. **Precios por Sucursal**: Flexibilidad tarifaria según la ubicación o canal de venta (Delivery vs. Mesa).

## Interacción con Base de Datos

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `products` | Maestros con `es_platillo = true`. Contiene `price` (global), `kitchen_station_id`. |
| `menu_categories` | Categorización exclusiva para la venta en POS. |
| `product_recipes` | Relaciona un platillo con sus ingredientes de la tabla `products`. |
| `product_branch_prices` | Precios diferenciados por sucursal y plataforma (Uber, PedidosYa). |
| `option_groups` | Grupos de opciones obligatorias (ej. "Tipo de Pan"). |
| `modifier_groups` | Grupos de agregados opcionales con costo extra (ej. "Extra Tocino"). |

### Relaciones Clave
- `products.menu_category_id` → `menu_categories.id`
- `product_recipes.product_id` → `products.id` (ID del Platillo)
- `product_recipes.inventory_item_id` → `products.id` (ID del Insumo)

### Consultas Principales
**Carga de Menú para el POS:**
```sql
SELECT p.id, p.name, p.price, p.image_url, c.nombre as cat_name
FROM products p
JOIN menu_categories c ON p.menu_category_id = c.id
WHERE p.es_platillo = true AND p.is_enabled = true;
```

**Consulta de Receta de un Platillo:**
```sql
SELECT 
    p_insumo.name as ingrediente, 
    r.quantity, 
    r.unit_measure
FROM product_recipes r
JOIN products p_insumo ON r.inventory_item_id = p_insumo.id
WHERE r.product_id = 'ID_DEL_PLATILLO';
```

---
*Documentación Técnica - Restaurante Las Palmas*

### `option_groups` y `options`
Personalización del producto.
- `multi`: Booleano para selección múltiple.
- `price`: Costo adicional por opción.

### `modifier_groups` y `modifiers`
Ajustes rápidos y notas con o sin costo.

---
*Documentación generada automáticamente como backup del sistema.*
