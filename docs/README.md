# Documentación del Proyecto: Restaurante Las Palmas POS

Este repositorio de documentación contiene la arquitectura técnica, lógica comercial y especificaciones de base de datos del sistema de Punto de Venta (POS) diseñado para el Restaurante Las Palmas.

## Plan de Documentación por Módulos

Cada módulo del sistema se ha documentado de forma individual para proporcionar una visión clara de su funcionamiento y su integración con la base de datos (Supabase/PostgreSQL).

### 📂 Estructura de Carpetas: `docs/modules/`

| Archivo | Descripción |
| :--- | :--- |
| 📦 [**Inventarios**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/inventarios.md) | Gestión de insumos, utensilios, stock y recetas técnicas. |
| 🍽️ [**Menú de Platillos**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/menu_platillos.md) | Administración detallada de productos para la venta, opciones y modificadores. |
| 📊 [**Contabilidad & SAT**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/contabilidad.md) | Sincronización automática con SAT, libros contables, planilla e impuestos. |
| 🛒 [**Ventas POS**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/ventas_pos.md) | Operación transaccional del restaurante, mesas, delivery y arqueos. |
| 💳 [**Cuentas por Cobrar**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/cuentas_por_cobrar.md) | Gestión de créditos comerciales y saldos de clientes corporativos. |
| ⚙️ [**Configuración Global**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/modules/configuracion.md) | Parámetros del sistema, seguridad (RLS), roles y periféricos. |
| 📔 [**Diccionario de Datos**](file:///c:/Users/CyR%20Las%20Palmas/Documents/Restaurante%20Las%20Palmas%20POS/docs/database_dictionary.md) | **[NUEVO]** Referencia maestra de tablas, columnas y lógica SQL. |

---

## Estándares de Redacción
Toda la documentación sigue un formato técnico dividido en:
1. **Descripción general**: Propósito del módulo.
2. **Categorías**: Elementos componentes.
3. **Interacción con Base de Datos**: Esquemas SQL y lógica de persistencia.

*Última actualización: Abril 2026*

Esta documentación sirve como respaldo técnico de la arquitectura del sistema al 28 de abril de 2026.
