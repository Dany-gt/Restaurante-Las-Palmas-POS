# Skill: Replica Exacta de Interfaz POS Nocturna

## 1. Paleta de Colores (Tokens de Color)
- **Fondo de la Aplicación (Fondo Principal):** `#1E1E2C` (Azul oscuro medianoche / grafito mate).
- **Contenedores y Paneles Laterales:** `#252538` (Un tono ligeramente más claro para separar secciones).
- **Botones de Modificadores (Naranja Opaco):** `#C07D4F` con texto en color crema/blanco.
- **Bordes y Separadores:** `#31314D` (Líneas finas, de 1px, muy sutiles).
- **Textos Principales:** `#FFFFFF` (Blanco puro para títulos y totales).
- **Textos Secundarios:** `#A0A0B0` (Gris claro para subtítulos o precios de Q0.00).

## 2. Tipografía y Textos
- **Fuente:** Sans-serif limpia, geométrica y condensada (Ej: `Inter`, `Roboto` o `SF Pro`).
- **Transformación:** TODO el texto de los botones y encabezados debe ir obligatoriamente en **MAYÚSCULAS**.
- **Tamaño:** Pequeño y compacto para optimizar espacio de pantalla táctil.

## 3. Componentes Visuales y Formas
- **Botones (Modificadores):** 
  - Esquinas redondeadas suaves (`border-radius: 8px`).
  - El texto del nombre va centrado arriba.
  - El precio (ej: Q0.00) va centrado abajo en un tamaño ligeramente menor.
- **Distribución de Botones:** Cuadrícula estricta (Grid) con separación limpia (`gap: 12px`).
- **Barra Lateral Derecha (Comanda):**
  - Ocupa aproximadamente el 25% del ancho total.
  - Dividida en filas horizontales simples con líneas de separación finas.
  - Los precios se alinean estrictamente a la derecha (`text-align: right`).
- **Botones de Acción Inferiores:**
  - Iconos lineales minimalistas (blancos sobre fondo del panel lateral).
  - El botón principal ("Enviar a Comanda") tiene un borde blanco fino que lo destaca.

## 4. Reglas de Construcción de Código
- NO utilices degradados llamativos, sombras paralelas (box-shadows) pronunciadas ni bordes redondeados exagerados.
- Mantén una estética plana, oscura ("Dark Mode" de restaurante) y de alto contraste para ambientes con poca luz.
