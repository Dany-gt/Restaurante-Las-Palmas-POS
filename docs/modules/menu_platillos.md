# Módulo: Menú de Platillos

Este módulo permite la administración de la oferta gastronómica del restaurante, gestionando desde la estructura de categorías hasta la complejidad de las recetas y personalizaciones.

## Categorías y Organización

El menú se estructura de la siguiente forma:
- **Categorías**: Agrupaciones lógicas de productos (ej. Entradas, Platos Fuertes, Bebidas, Postres).
- **Sub-Categorías**: Permite una jerarquía más profunda para menús extensos.
- **Orden de Visualización**: Control total sobre el índice de aparición en el POS.

## Funcionamiento del Producto

### Configuración de Producto
Cada platillo contiene:
- **Datos Básicos**: Nombre, descripción, precio y categoría.
- **Disponibilidad**: Interruptor maestro para activar/desactivar productos agotados.
- **Estación de Cocina**: Define a qué pantalla (KDS) o impresora se envía el ticket de preparación (ej. Cocina, Barra, Horno).

### Opciones y Modificadores
El sistema soporta personalización avanzada:
- **Grupos de Opciones**: Selección de guarniciones, términos de carne, tipos de salsa.
  - Soporta selección única o múltiple.
  - Permite establecer límites mínimos y máximos de selección.
- **Modificadores**: Adicionales con costo extra o notas especiales.

### Recetas / Ficha Técnica (Integración con Inventarios)
Los platillos pueden vincularse a insumos del inventario para:
- Descontar existencias automáticamente al vender.
- Calcular el costo real de producción por plato.
- Visualizar margen de ganancia en tiempo real.

## Esquema SQL (Tablas Principales)

### `categories`
Jerarquía del menú.
- `id`, `name`, `parent_id`, `order_index`.

### `products`
Catálogo de platillos.
- `category_id`: Relación con categoría.
- `kitchen_station_id`: Relación con la estación de preparación.
- `price`, `is_available`.

### `option_groups` y `options`
Personalización del producto.
- `multi`: Booleano para selección múltiple.
- `price`: Costo adicional por opción.

### `modifier_groups` y `modifiers`
Ajustes rápidos y notas con o sin costo.

---
*Documentación generada automáticamente como backup del sistema.*
