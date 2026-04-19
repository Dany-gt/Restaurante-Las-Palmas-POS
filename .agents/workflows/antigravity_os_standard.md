---
description: Antigravity OS Standard - Directrices para Modales y Diseño Clásico Windows
---
# Antigravity OS Standard

Directrices obligatorias para la creación y refactorización de interfaces gráficas, específicamente en elementos tipo ventana/modal (Classic Windows Design) dentro de la aplicación Admin.

## 1. Modales: Ventanas Flotantes y Portales (Obligatorio)
Para evitar que los modales queden ocultos detrás de barras de navegación o cortados por propiedades `overflow: hidden` de sus contenedores padre, **TODOS los modales estilo ventana de Windows deben renderizarse utilizando `createPortal` de `react-dom` directo al `document.body`**.

### Estructura Base de un Modal Clásico:
```tsx
import { createPortal } from 'react-dom';
import { DraggableWindow } from './AdminPortal';
// ...
{showModal && typeof document !== 'undefined' && createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
        <DraggableWindow>
            <div className="w-[500px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto">
                {/* Header (Mover Modal) */}
                <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                    <div className="flex items-center gap-2">
                        {/* ICONO AQUÍ */}
                        <span className="text-white text-[12px] font-bold tracking-wide">Título de Ventana</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <WindowsSaveButton onClick={handleSave} loading={isSaving} variant="minimal" title="Guardar" />
                        <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body (Contenido) */}
                <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300">
                    {/* Elementos estilo fieldset clásico */}
                </div>
            </div>
        </DraggableWindow>
    </div>,
    document.body
)}
```

#### Reglas de Estética del Modal:
- **Sobresalir (`createPortal`)**: El uso de `createPortal` es NO negociable.
- **Marco Exterior**: `border-[#106EBE]`.
- **Área de Arrastre (`.modal-header`)**: Debe tener obligatoriamente la clase `modal-header`.
- **Icono de Guardado**: Usar el componente `WindowsSaveButton` con `variant="minimal"` para asegurar el icono de disquet "Premium" consistente.
- **Botón Cerrar**: Fondo transparente pero con recubrimiento rojo clásico al pasar el mouse `hover:bg-red-500`. Sizing sugerido `w-8 h-8` con icono `X` en `size={18}`.

## 2. Menús Contextuales Universales
Todo componente visual (como una tabla de registros o una lista) DEBE incluir interactividad de `onContextMenu` (clic derecho universal).

- **Estado Vacío**: Si un panel no posee registros de datos, el contenedor envolvente de igual forma DEBE atrapar el evento `onContextMenu` para permitir un comportamiento interactivo predeterminado como: `Crear` / `Vincular Nuevo`.
- **Menú Flotante**: El popup del menú contextual no debe usar difuminados (nada de *glassmorphism*). Debe llevar sombra sólida y bordes claros (`border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)]`).

## 3. Protocolo de Legibilidad y Contraste
- **Cero Texto Invisible**: Si el fondo es blanco (`bg-white`) o un gris claro (`bg-slate-100` / `bg-[#f0f0f0]`), utiliza automáticamente un gris oscuro (`text-slate-900`) o negro para garantizar legibilidad absoluta.

## 4. Eliminación de Efectos "Fantasma"
- **Adiós al Blur**: Queda terminantemente prohibido el uso de `backdrop-blur-*` en las ventanas principales de configuración de la UI *Admin*. Si necesitas resaltar algo usa fondos opacos simples u oscurecidos leves como `bg-black/5` para el backdrop de bloqueo en los modales tipo popup.
- **Colores Sólidos**: Utiliza la paleta `slate` o los estándares hex (ej. Azul Institucional Microsoft `#106EBE` para topbars y bordes, rojo puro para cerrar, o gris claro `#f0f0f0` clásico de form). Pautas limpias, sombras sólidas de estilo Desktop.

## 5. Data Grids y Formularios Compactos
Para asemejar los listados a componentes reales "DataGrid" clásicos e interfaces WinForms densas:
- **Tablas/Grids**: Las cabeceras deben usar tipografía diminuta y no forzosamente en mayúsculas (`text-[10px] font-bold text-slate-800 tracking-tight`). Nunca usar padding excesivo, mantener la densidad alta (`py-1 px-4`).
- **Separadores de Tabla**: Usa colores sólidos como `border-gray-300`, fondos grises `bg-[#f0f0f0]` para las cabeceras y rayas horizontales simples para el contenido.
- **Inputs y Controles**: Las cajas de texto y selects deben ser visualmente "pequeñas", normalmente `text-[11px]`, bordes definidos `border-gray-400`, altura baja (`h-7` o `py-1`), y no deben estirarse demasiado horizontalmente. Usa anchos fijos o controlados (ej. `w-[250px]`).
- **Classic Checkbox (Data Grid)**: Para checklists o indicadores de estado en tablas, utilizar exclusivamente el siguiente patrón visual ("Skill"):
  ```tsx
  <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${active ? 'bg-[#106EBE] border-[#106EBE] text-white' : 'bg-white border-gray-300'}`}>
      {active && <Check size={10} strokeWidth={4} />}
  </div>
  ```

En caso de duda y cualquier nueva vista de listado o mantenimiento de configuración, priorizar el "Aspecto Escritorio Denso y Preciso" sobre una presentación tipo App Web Moderna expansiva.

## 6. Category Tree Panels (Windows Classic Treeview)
Al implementar paneles de jerarquía de categorías para filtrar o asignar datos masivamente (como el panel lateral de categorías), DEBES emplear el siguiente patrón (Design & Function Skill):
- **Cero Carpetas Amarillas**: Evitar usar `<Folder />` para nodos. Utilizar `<Square />` y `<CheckSquare />` lucide-icons para simular una casilla de verificación multiselección por cada categoría (padre o hijo).
- **Control de Expansión Separado**: Mantener el botón de anidar/colapsar `<ChevronRight />` / `<ChevronDown />` independiente del checkbox de selección.
- **Jerarquía y Multiselección (El "Skill" de Selección)**: 
    -   **Mapeo de Categorías Incorrecto y Duplicados**: 
        -   Existen múltiples categorías con el mismo nombre (ej. "AGUA PURA" en `categories`, `menu_categories` y `product_categories`).
        -   Los productos están vinculados a IDs de distintas tablas.
        -   Implementaré un "Puente por Nombre": Si seleccionas una categoría, el sistema mostrará productos vinculados a **cualquier** ID que tenga ese mismo nombre.
        -   **Consolidación de Productos**: Si hay dos productos con el mismo nombre (uno con precio y otro sin precio), el sistema mostrará únicamente el que tiene el precio correcto.
    -   **UI de Logo y Marcadores**: Restaurar el `PlaceholderLogo` original (que dice "Restaurante Las Palmas POS") en lugar del icono de paquete para categorías sin foto.
    -   **UI Vacía y Caché Corrupta**: Forzar salto a **v1.3.4** para asegurar limpieza total.
- **Jerarquía y Multiselección (El "Skill" de Selección)**: Se debe usar un `Set<string>` para guardar las `selectedCategories`. Al hacer clic en el contenedor (o el checkbox):
  - Si es padre, selecciona automáticamente a TODOS sus hijos (recursivamente).
  - Si se deselecciona un padre, deselecciona todos los hijos.
  - Al renderizar, los padres van en **Negrita**, el fondo de cabecera es Gris Claro `bg-[#f0f0f0]` (sin azules oscuros), y se usa estilo de tabla sobrio.

## 7. Custom Selects & Dropdowns (Controlled Lists)
Al implementar selectores de datos (como Catálogo de Categorías, Proveedores, etc.), se deben seguir estas reglas para evitar que la interfaz "brinque" o se desborde fuera del campo visual:

- **No usar <select> Nativo para listas largas**: Para cualquier lista con más de 10 elementos, utilizar componentes de dropdown personalizados basados en un `div` absoluto.
- **Dirección Descendente (Regla de Oro)**: Los menús desplegables deben anclarse obligatoriamente para abrirse **hacia abajo** (`top-full mt-1`). Evitar el uso de `bottom-full` (apertura hacia arriba), ya que suele ser menos intuitivo y puede ser cortado por el límite superior del modal o del navegador.
- **Scrollbar Visible y Estilizada**: La "barra de desplazamiento" es obligatoria para listas largas. Se debe utilizar la clase `.custom-scrollbar` con el siguiente estilo para garantizar una barra fina, gris y discreta que ayude a la orientación del usuario:
  ```css
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #999; }
  ```
- **Altura Máxima Controlada**: Limitar el contenedor de la lista con `max-h-48` (o similar) para que la ventana modal mantenga su estabilidad estructural.
- **Buscador Integrado (Searchable)**: Si la lista es dinámica, incluir un campo de texto para filtrar opciones, facilitando la selección rápida sin tener que navegar por todo el catálogo manualmente.
