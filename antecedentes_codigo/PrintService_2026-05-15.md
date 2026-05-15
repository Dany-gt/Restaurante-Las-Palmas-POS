# Antecedentes de Código: PrintService.ts
Fecha: 2026-05-15

## [ANTES]
```typescript
332:         // 🛠️ TRADUCCIÓN CRÍTICA: Convertimos HTML a texto limpio con comandos ESC/POS básicos
333:         const rawContent = this.htmlToEscPos(html);
334:         
335:         const r = await electron.printToNetwork(netPrinter.address, netPrinter.port, rawContent, true);
...
1027:   public htmlToEscPos(html: string): Uint8Array {
...
1034:     commands.push(ESC, 0x40); 
...
1039:       if (node.nodeType === Node.TEXT_NODE) {
1040:         const text = (node.textContent || '')
1041:           .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos para evitar símbolos raros
1042:           .replace(/[^\x20-\x7E\x0A\x0D]/g, ""); // Solo caracteres ASCII básicos
...
1054:         const isBold = el.style.fontWeight === 'bold' || el.style.fontWeight === '900' || ['H1', 'H2', 'H3', 'STRONG', 'B'].includes(tagName);
1055:         if (isBold) commands.push(ESC, 0x45, 0x01); // Bold ON
...
1058:         const textAlign = el.style.textAlign || (el.classList.contains('header') ? 'center' : 'left');
```

## [DESPUÉS]
```typescript
332:         // 🛠️ TRADUCCIÓN CRÍTICA: Convertimos HTML a texto limpio con comandos ESC/POS básicos
333:         const rawContent = this.htmlToEscPos(html, { openDrawer: netPrinter.opens_cash_drawer });
334:         
335:         const r = await electron.printToNetwork(netPrinter.address, netPrinter.port, rawContent, true);
...
1027:   public htmlToEscPos(html: string, options: { openDrawer?: boolean } = {}): Uint8Array {
...
1034:     commands.push(ESC, 0x40); 
1035: 
1036:     // 2. Pulso de gaveta (opcional, al inicio para evitar esperas)
1037:     if (options.openDrawer) {
1038:       commands.push(ESC, 0x70, 0x00, 0x19, 0xFA);
1039:     }
...
1051:       if (node.nodeType === Node.TEXT_NODE) {
1052:         let text = (node.textContent || '')
1053:           .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
1054:           .replace(/[^\x20-\x7E\x0A\x0D]/g, ""); // Solo ASCII básico
1055:         
1056:         // Trim text to avoid extra spaces if it's just whitespace between tags
1057:         if (!text.trim() && text.length > 0) return;
...
1070:         // Estilos de texto (Negrita y Tamaño)
1071:         const isBold = el.style.fontWeight === 'bold' || el.style.fontWeight === '900' || ['H1', 'H2', 'H3', 'STRONG', 'B'].includes(tagName);
1072:         const isBig = tagName === 'H1' || (el.style.fontSize && parseInt(el.style.fontSize) > 16);
1073:         const isMedium = tagName === 'H2' || tagName === 'H3' || (el.style.fontSize && parseInt(el.style.fontSize) > 12);
1074: 
1075:         if (isBold) commands.push(ESC, 0x45, 0x01); // Bold ON
1076:         if (isBig) commands.push(GS, 0x21, 0x11); // Double width & height
1077:         else if (isMedium) commands.push(GS, 0x21, 0x01); // Double height
...
1079:         // Alineación
1080:         const textAlign = el.style.textAlign || (el.classList.contains('header') || el.classList.contains('text-center') ? 'center' : 'left');
...
1084:         // Caso especial: Separador (HR o clase divider)
...
1091:         // Caso especial: Item de ticket (Item-Row) - Intentar alinear columnas
```
