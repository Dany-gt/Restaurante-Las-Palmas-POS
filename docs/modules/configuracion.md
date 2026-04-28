# Módulo: Configuración del Sistema

Este módulo permite ajustar el comportamiento global de la aplicación, gestionar usuarios, permisos y periféricos.

## Categorías de Ajustes

### 1. Datos del Establecimiento
- **Identidad**: Nombre comercial, NIT, dirección legal y de facturación.
- **Fiscal**: Configuración de porcentajes de impuestos (IVA), leyendas de certificador (SAT/Infile) y frases de factura.

### 2. Estaciones de Impresión y KDS
- **Periféricos**: Configuración de impresoras térmicas y pantallas de cocina.
- **Ruteo**: Define qué productos se imprimen o visualizan en cada estación.
- **PrintNode**: Integración para impresión remota desde la nube.

### 3. Gestión de Accesos (RBAC)
- **Roles**: ADMIN, CAJERO, MESERO, COCINA.
- **Perfiles**: Registro de usuarios con nombre completo y PIN de acceso rápido de 4 dígitos.
- **Permisos**: Control granular sobre acciones sensibles (Void, Descuentos, Reportes).

### 4. Parámetros Operativos
- Propinas sugeridas (%).
- Monedas (Símbolo).
- Configuración de alertas sonoras para KDS.
- Control de bloqueos de mesa.

## Esquema SQL (Tablas Principales)

### `system_settings`
Tabla única de configuración global.
- `restaurant_name`, `nit`, `address`.
- `enable_billing`: Switch maestro de facturación electrónica.
- `tax_percentage`, `suggested_tip`.
- `printnode_api_key`.

### `kitchen_stations`
Gestión de dispositivos de salida.
- `device_type`: 'PRINTER' | 'KDS'.
- `num_copies`.

### `roles` y `profiles`
Seguridad y usuarios.
- `permissions`: Campo JSONB con los privilegios asignados.
- `pin`: PIN de seguridad para autenticación en el POS.

### `printers`
Modelos y rutas de impresoras configuradas.

---
*Documentación generada automáticamente como backup del sistema.*
