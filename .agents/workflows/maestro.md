---
description: Maestro Workflow - Estrategias de Diagnóstico, Fortalecimiento y Optimización para el POS
---
# Maestro: Workflow Fluency

Este flujo de trabajo implementa las estrategias de Maestro para garantizar un código de alta fidelidad, libre de defectos y optimizado para la eficiencia operativa del Restaurante Las Palmas.

## 1. /diagnose (Diagnóstico de Salud)
Usa este comando para auditar una pantalla o módulo antes de realizar cambios significativos.
- **Objetivo**: Detectar cuellos de botella, inconsistencias de diseño o deuda técnica.
- **Protocolo**:
    1. Revisar `.maestro.md` para alineación de contexto.
    2. Analizar el componente actual contra el `antigravity_os_standard.md`.
    3. Identificar puntos de fallo (queries pesadas, estados redundantes).
- **Entregable**: Reporte de hallazgos con prioridad (Baja/Media/Alta/Crítica).

## 2. /fortify (Robustez y Blindaje)
Usa este comando para "envolver" el código en capas de seguridad.
- **Objetivo**: Evitar crashes de UI y asegurar la integridad de los datos en Supabase.
- **Protocolo**:
    1. Implementar `optional chaining` en todos los accesos a datos externos.
    2. Agregar estados de carga (`loading`) y errores (`error`) visualmente coherentes.
    3. Validar entradas de usuario antes de enviarlas al servidor.
- **Próximo paso**: Ejecutar `/unit-test` para validar el blindaje.

## 3. /streamline (Optimización y Simplificación)
Usa este comando para "adelgazar" procesos pesados y mejorar la velocidad.
- **Objetivo**: Reducir el tiempo de carga y respuesta de la interfaz.
- **Protocolo**:
    1. Eliminar renders innecesarios usando `useMemo` o `useCallback` si aplica.
    2. Simplificar queries de Supabase para traer solo las columnas necesarias.
    3. Reducir la profundidad del árbol de componentes.

## 4. /zero-defect (Garantía de Calidad Total)
Usa este comando antes de dar una tarea por terminada.
- **Objetivo**: Asegurar que el componente cumple con el 100% de los requisitos y no tiene errores lógicos.
- **Checklist**:
    - [ ] ¿Cumple con el diseño Antigravity OS (Modales, Densidad)?
    - [ ] ¿Hay manejo de errores para datos nulos?
    - [ ] ¿Se actualizó la memoria en `.kilocode/rules/memory-bank/`?
    - [ ] ¿Es rápido y responsivo?

## 5. /extract-pattern (Normalización)
Usa este comando para documentar un nuevo descubrimiento técnico o de diseño.
- **Acción**: Escribir el nuevo patrón en `.kilocode/rules/memory-bank/systemPatterns.md`.
