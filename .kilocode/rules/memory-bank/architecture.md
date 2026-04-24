# Architecture: Restaurante Las Palmas POS

## Design System: Antigravity OS
- **Layout**: Diseño panorámico, alta densidad de datos.
- **Paleta**: Fondos oscuros (`#1a1f2e`, `#0d1117`), acentos neón (`#0cf192`, `#106EBE`).
- **Componentes**: Bordes redondeados (`32px`, `48px`), efectos de glassmorphism, sombras pronunciadas.

## Production Module Logic (Split-View)
- **Operacional (Izquierda)**: Concentra herramientas críticas (Timer e Insumos). Prioridad en usabilidad táctil.
- **Técnico (Derecha)**: Centraliza información de consulta (Ficha Técnica, Procedimientos, Bitácora).

## Data Integrity
- Uso de `maybeSingle()` y `optional chaining` para evitar crashes por datos nulos.
- Mecanismos de `fallback` en queries para manejar esquemas de base de datos en transición.
