# Antecedentes: Corrección de Gaveta y Estética en Impresión de Red

**Fecha:** 2024-05-15
**Archivo:** `services/PrintService.ts`

## Problemas Detectados
1. **Apertura Indebida**: La gaveta de dinero se abría al imprimir la precuenta (documento no contable) en impresoras de red.
2. **Estética Deficiente**: El motor `htmlToEscPos` no manejaba correctamente la alineación de columnas (info-grid) ni el encabezado del restaurante, resultando en tickets desordenados comparados con la versión de Windows.

## Cambios Propuestos
1. Modificar `executePrint` para aceptar un flag `openDrawer` que prevalezca sobre la configuración de la impresora.
2. Actualizar `printPreAccountTicket` para pasar `openDrawer: false`.
3. Refactorizar `htmlToEscPos` para:
   - Detectar y alinear horizontalmente elementos dentro de `.info-grid`.
   - Mejorar el procesamiento del encabezado del restaurante.
   - Ajustar anchos de columna en `item-row`.

## Estado Anterior (Fragmento Crítico)
```typescript
// executePrint siempre usaba netPrinter.opens_cash_drawer
const rawContent = this.htmlToEscPos(html, { openDrawer: netPrinter.opens_cash_drawer });

// htmlToEscPos procesaba cada DIV con un salto de línea (LF)
if (['DIV', 'H1', 'H2', 'H3', 'P', 'BR', 'TR'].includes(tagName)) {
  commands.push(LF);
}
```
