---
description: Aplica el estándar visual de Las Palmas (botones Aceptar/Cancelar centrados, íconos blancos, tipografía espaciada y bordes sutiles).
---

# Estética Visual - Restaurante Las Palmas POS

> **Mục tiêu / Objetivo**: Mantener una consistencia visual impecable en todas las pantallas del POS, asegurando que los botones, íconos y textos compartan el mismo ADN de diseño (Ash-Gray, bordes sutiles, tipografía espaciada).

## 🛠️ Instrucciones de Implementación (Para el Agente)

Cuando el usuario solicite "aplicar el estilo de botones/letras/iconos" o llame al comando `/estetica-palmas`, debes auditar el componente actual y reemplazar las clases de Tailwind con los siguientes estándares:

### 0. Paleta de Colores Base (Ash-Gray)
Toda la interfaz debe seguir el esquema de colores oscuros con tonos azulados/grisáceos característico del sistema:
- **Fondo de Paneles Principales (Izquierda) / Modales**: `bg-[#2d2e3d]`
- **Fondo de Barra Derecha / Fondo General**: `bg-[#232431]` o hereda del layout.
- **Encabezados / Tarjetas Inactivas**: `bg-[#3a3b4d]`
- **Tarjetas Activas / Hover Suave**: `bg-[#45465a]` o `bg-[#5c5d73]`
- **Separadores / Bordes sutiles**: `border-white/5` o `border-white/10`

### 1. Tipografía Global (Textos y Etiquetas)
Los textos de la interfaz (labels, encabezados de botones) deben verse modernos, limpios y espaciados.
- **Clases base**: `text-[11px]` o `text-[12px]`, `uppercase`, `font-bold` (o `font-semibold`), `tracking-[0.15em]` (o `tracking-widest`).
- **Color**: `text-white` (principal) o `text-white/70` (secundario).

### 2. Íconos (Lucide React)
Los íconos deben ser elegantes, consistentes y no demasiado grandes.
- **Propiedades**: `size={18}` (o `16` para lugares apretados), `strokeWidth={1.5}`.
- **Color**: Deben heredar el color blanco (`text-white`) de su contenedor o usar `color="currentColor"`.

### 3. Botones Cuadrados de Acción (Ej. Barra Inferior)
Para botones que solo contienen un ícono (como los de agregar usuario, editar, ocultar teclado).
```tsx
<button className="h-12 w-14 rounded-lg bg-transparent border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-colors">
    <UserPlus size={18} strokeWidth={1.5} />
</button>
```

### 4. Botones de Modales (Aceptar y Cancelar)
Deben estar **centrados** en su contenedor (usando `justify-center` en el `div` padre). Su tamaño debe ser compacto (`h-10`, `px-8`).

**Contenedor**:
```tsx
<div className="mt-6 pt-4 border-t border-white/5 flex justify-center items-center gap-4">
    {/* Botones aquí */}
</div>
```

**Botón Cancelar (Secundario)**:
```tsx
<button className="h-10 px-8 rounded-lg bg-transparent border border-white/10 text-[11px] font-bold tracking-[0.15em] text-white/70 hover:text-white hover:bg-white/5 transition-colors uppercase">
    CANCELAR
</button>
```

**Botón Aceptar (Primario)**:
```tsx
<button className="h-10 px-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-[11px] font-bold tracking-[0.15em] text-white transition-colors uppercase">
    ACEPTAR
</button>
```

### 5. Entradas de Texto (Inputs)
Los inputs deben fundirse con el fondo oscuro, resaltando solo al hacer foco.
- **Clases**: `bg-black/20 border border-white/10 rounded-lg text-white text-[12px] font-medium placeholder:text-white/30 focus:border-indigo-500/50 focus:bg-black/40 outline-none transition-all`.

## 🚀 Cómo usar este workflow
El usuario puede escribir:
- `"/estetica-palmas en el Modal de Pagos"`
- `"Aplica tu estilo de letras y el tamaño de iconos a esta ventana"`
El Agente refactorizará el diseño de esa pantalla para que coincida milimétricamente con estas reglas.
