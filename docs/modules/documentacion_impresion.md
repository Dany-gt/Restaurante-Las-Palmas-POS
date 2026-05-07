# 🖨️ Documentación de Impresión y Hardware

Esta guía detalla la arquitectura de impresión, el control de hardware (cajón monedero) y los estándares de diseño de tickets para el sistema POS de **Restaurante Las Palmas**.

## 🏗️ Arquitectura de Comunicación
El sistema utiliza un puente híbrido para garantizar la compatibilidad en diferentes entornos:

1.  **Electron (ContextBridge):** Proceso principal que maneja sockets TCP (`net`) para impresoras de red y el API de impresión nativo de Chromium para impresoras de sistema (USB/Driver).
2.  **PrintService (Frontend):** Orquestador en React que genera plantillas HTML5/CSS3 y decide la ruta de impresión (Local, Red o Nube vía PrintNode).
3.  **Plantillas Dinámicas:** Los tickets se renderizan como HTML con un ancho dinámico (80mm o 58mm) y fuentes optimizadas (Roboto).

---

## 🎨 Diseños de Documentos

### 1. Precuenta (Ticket de Cobro)
*   **Propósito:** Mostrar el subtotal al cliente antes del pago final.
*   **Elementos Clave:**
    *   Encabezado del restaurante con logo de texto y sitio web.
    *   Detalle de Mesa, Mesero y Número de Orden.
    *   **Interactividad:** Espacios en blanco con bordes definidos para que el cliente escriba manualmente su **NIT** y **Nombre/Dirección** para la factura.
    *   **Nota Legal:** "Esto no es un documento contable".

### 2. Factura FEL (Documento Tributario Electrónico)
*   **Propósito:** Comprobante legal certificado por SAT.
*   **Elementos Clave:**
    *   **Datos DTE:** UUID (Autorización), Serie y Número.
    *   **Certificación:** Leyenda del certificador (Infile) y frases obligatorias según resolución.
    *   **Código QR:** Generado dinámicamente mediante `quickchart.io` para validación inmediata ante SAT.
    *   **Anulación:** Si la factura es anulada, se imprime una marca de agua visual (borde rojo de 2px) y el texto central "FACTURA ANULADA" con el motivo.

### 3. Cierre de Turno (Reporte Z)
*   **Propósito:** Auditoría diaria y cuadre de efectivo.
*   **Estructura Financiera:**
    *   **Métricas de Operación:** Órdenes totales, platos borrados y comensales.
    *   **Ventas por Método:** Desglose de Efectivo vs Tarjeta.
    *   **Algoritmo de Cuadre:**
        ```text
        (+) Saldo Inicial (Caja Chica)
        (+) Ventas en Efectivo
        (+) Propinas en Efectivo
        (-) Gastos del Turno
        -----------------------
        (=) EFECTIVO ESPERADO vs CONTADO
        ```
    *   **Validación:** Indica visualmente si la caja está "CUADRADA" o si existe una diferencia.

### 4. Vale de Anulación
*   **Propósito:** Control interno cuando se elimina un producto ya enviado a cocina.
*   **Diseño:** Título en fuente 16px (Extra Bold), nombre del mesero y una descripción gigante del producto eliminado para que el supervisor lo firme.

---

## 🔧 Configuración de Hardware

### Cajón Monedero (Cash Drawer)
*   **Método:** Pulso eléctrico vía puerto RJ11 de la impresora térmica.
*   **Comando ESC/POS:** `0x1b 0x70 0x00 0x19 0xfa` (ESC p 0 25 250).
*   **Integración:**
    *   **Red:** Socket TCP directo al puerto 9100.
    *   **Sistema:** Configurado a través del driver de Windows como "Open Drawer Before Printing".

### Impresoras Soportadas
*   **Ancho 80mm:** Estándar para salón y facturación.
*   **Ancho 58mm:** Soportado automáticamente mediante CSS Media Queries en las plantillas.

---

## 🛠️ Debugging y Pruebas
Para verificar la conexión de una nueva impresora, se puede utilizar la consola de desarrollador:
```javascript
// Prueba de conexión desde el POS
await printService.checkConnection('192.168.88.XX', 9100);

// Prueba de apertura de caja
await printService.openCashDrawer({ userName: 'Admin', reason: 'Prueba Técnica' });
```

> [!IMPORTANT]
> Los logs de hardware se guardan en la tabla `cash_drawer_logs` de Supabase para auditoría ante aperturas manuales no autorizadas.
