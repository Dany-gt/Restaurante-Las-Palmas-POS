# Documentación del Sistema de Iconografía Premium - Páladar POS

Este documento detalla la implementación, origen y gestión del nuevo sistema de iconos "Flat Business" integrado en el **Restaurante Las Palmas POS**.

## 1. Origen y Recursos
Los iconos utilizados pertenecen a la colección **Flat Color Icons** (creada originalmente por **Icons8**).
- **Proveedor:** [Iconify.design](https://icon-sets.iconify.design/flat-color-icons/)
- **Prefijo de Identificador:** `flat-color-icons:`
- **Formato:** SVG Vectorial (alta resolución en cualquier tamaño).

## 2. Arquitectura de Implementación

### Componente Central: `PremiumIcon.tsx`
Toda la lógica y el catálogo de iconos se encuentran en:
`components/shared/PremiumIcon.tsx`

Este componente actúa como un "wrapper" que recibe un identificador y renderiza el SVG correspondiente. Contiene el objeto `ICON_MAP`, que asocia los nombres de los módulos del POS con los identificadores reales de la librería.

**Ejemplo de Mapeo:**
```typescript
export const ICON_MAP = {
  TABLES: 'flat-color-icons:grid',
  DELIVERY: 'flat-color-icons:shipped',
  // ... más de 80 mapeos específicos
};
```

### Integración en la Interfaz: `AdminPortal.tsx`
El menú principal (Ribbon) de la administración utiliza este sistema en:
`components/admin/AdminPortal.tsx`

**Características técnicas:**
- **Escalabilidad:** Los iconos del Ribbon se han configurado a **32px** para el modo estándar y **18px** para el modo compacto/listados.
- **Reactividad:** El sistema detecta el cambio en `system_settings` (tema `classic` vs `premium`) y cambia los iconos en tiempo real sin recargar la página.

## 3. Ubicación de Archivos Clave

| Propósito | Ruta del Archivo |
|-----------|------------------|
| **Lógica y Catálogo** | `components/shared/PremiumIcon.tsx` |
| **Menú Principal (Ribbon)** | `components/admin/AdminPortal.tsx` |
| **Listados de Inventario** | `components/admin/inventarios/ListadoPlatillos.tsx` |
| **Listados de Productos** | `components/admin/inventarios/ListadoProductos.tsx` |

## 4. Guía de Mantenimiento (Cómo agregar iconos)

Si se crea un nuevo módulo y se desea asignarle un icono premium:

1. Busca el icono deseado en [Iconify Flat Color Icons](https://icon-sets.iconify.design/flat-color-icons/).
2. Copia el nombre (ejemplo: `factory`).
3. Abre `PremiumIcon.tsx` y añade una nueva clave al `ICON_MAP`:
   ```typescript
   NUEVO_MODULO: 'flat-color-icons:factory',
   ```
4. En el archivo del módulo (ejemplo: `AdminPortal.tsx`), asigna esa clave a la propiedad `iconify` del ítem del menú.

---
**Documentación generada el:** 08 de Mayo, 2026.
**Estado del Sistema:** Migración al 100% completada en módulos administrativos.
