---
description: Aplica el efecto de anti-solapamiento para el teclado virtual derecho. Desliza modales y formularios a la izquierda al escribir.
---

# Efecto de Teclado Virtual (Anti-Solapamiento)

> **Mục tiêu / Objetivo**: Evitar que el teclado virtual en pantalla (que aparece del lado derecho en monitores EloTouch) tape los campos de texto en modales o formularios. 

## ¿En qué consiste el efecto?
Al hacer clic en un campo de texto, el formulario completo se desliza suavemente hacia la parte superior izquierda de la pantalla. Al cerrar el teclado o hacer clic fuera del formulario, este regresa de forma fluida al centro de la pantalla.

## 🛠️ Instrucciones de Implementación (Para el Agente)

Cuando el usuario pida aplicar el "efecto de teclado" a un nuevo modal o pantalla, sigue estos pasos exactos:

### 1. Estado de Escritura (`isTyping`)
Agrega un estado local en el componente afectado para rastrear si el usuario está interactuando con los campos de texto:
```tsx
import { useState } from 'react';
// ...
const [isTyping, setIsTyping] = useState(false);
```

### 2. Contenedor Dinámico y Gestor de Foco (onFocus / onBlur)
Envuelve el formulario o modal principal en un contenedor (preferiblemente un `motion.div` de Framer Motion) y añade los eventos `onFocus` y `onBlur`. 
- `onFocus`: Activa el modo escritura.
- `onBlur`: Verifica si el nuevo foco está fuera del contenedor actual. Si es así, desactiva el modo escritura.

```tsx
import { motion } from 'framer-motion';

<motion.div
    layout
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    onFocus={() => setIsTyping(true)}
    onBlur={(e) => {
        // Solo desactivar si el clic fue fuera de este contenedor
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsTyping(false);
        }
    }}
    className="fixed inset-0 z-[100] flex items-center p-4"
    style={{
        // Si está escribiendo, justificar a la izquierda con un padding. Si no, al centro.
        justifyContent: isTyping ? 'flex-start' : 'center',
        paddingLeft: isTyping ? '3rem' : '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.75)' // Fondo oscuro habitual
    }}
>
    <motion.div layout className="bg-[#2d2e3d] rounded-xl shadow-2xl ...">
        {/* Contenido del Modal / Formulario */}
    </motion.div>
</motion.div>
```

### 3. Eliminar `autoFocus`
Para evitar que el teclado brinque automáticamente al cargar la pantalla (bloqueando la vista), **NUNCA** utilices la propiedad `autoFocus` en los inputs principales de pantallas táctiles, a menos que sea estrictamente necesario o solicitado.

### 4. Dependencia del Teclado Virtual (Requisito Previo)
Este efecto asume que el archivo `components/VirtualKeyboard.tsx` ya cuenta con la corrección en su botón de "CERRAR" (`handleClose`), el cual debe ejecutar `blur()` sobre el elemento activo para que el `onBlur` del modal se dispare correctamente:
```tsx
const handleClose = () => {
    setIsVisible(false);
    if (activeElement) {
        activeElement.blur();
    } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
};
```
*(Esta corrección ya fue aplicada globalmente en el sistema).*

## 🚀 Cómo usar este workflow
El usuario puede simplemente decir: 
- `"/efecto-teclado en el modal de Nuevo Producto"`
- `"Aplica el efecto del teclado en PaymentModal.tsx"`
El Agente leerá este documento y aplicará el patrón estructural descrito en el Paso 2.
