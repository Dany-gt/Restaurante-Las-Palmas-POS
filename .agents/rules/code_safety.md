# Regla de Seguridad: Trazabilidad y Antecedentes de Código

Esta es una regla obligatoria para todas las intervenciones de código en este repositorio.

## Objetivo
Evitar la pérdida de funcionalidad y permitir la auditoría quirúrgica de cada cambio realizado por la IA.

## Procedimiento Obligatorio
Cada vez que se realice una modificación en cualquier archivo del proyecto, se DEBE:

1.  **Identificar el estado previo**: Capturar las líneas exactas que van a ser modificadas o eliminadas.
2.  **Crear un archivo de antecedente**: Guardar en la carpeta `antecedentes_codigo/` un archivo con el formato `NombreArchivo_YYYY-MM-DD.md`.
3.  **Documentar el [ANTES] y [DESPUÉS]**:
    -   Utilizar bloques de código de Markdown.
    -   Incluir números de línea si es posible para facilitar la ubicación.
    -   Explicar brevemente la razón del cambio si no es obvia.

## Ubicación de Respaldos
`root/antecedentes_codigo/`

## Enfoque Estricto en lo Solicitado
- **Obediencia Directa**: Se debe obedecer ÚNICAMENTE a lo solicitado en la petición actual.
- **Ignorar Contexto Irrelevante**: No se deben realizar acciones basadas en conversaciones pasadas o sugerencias previas si no han sido solicitadas expresamente en el turno actual.
- **Prohibición de Sugerencias No Pedidas**: No proponer ni ejecutar cambios en código, IPs, o configuraciones de hardware que el usuario no haya pedido explícitamente, incluso si se mencionaron como "sugerencias" anteriormente.

## Prohibiciones
-   NO borrar código sin antes haberlo respaldado en antecedentes.
-   NO realizar modificaciones masivas sin documentar los puntos críticos afectados.
-   NO tocar lógica no relacionada con la tarea actual.
-   NO realizar cambios automáticos basados en suposiciones o sugerencias pasadas.
