# 🔌 Auditoría Modo Offline — Restaurante Las Palmas POS
**Fecha:** 2026-05-06 | **Versión Sistema:** 1.3.1 | **Metodología:** debugger, systematic-debugging, wiki-architect

---

## Resumen Ejecutivo

El sistema **SÍ tiene capacidad offline parcial** implementada. Utiliza **IndexedDB** (almacenamiento del navegador) como base de datos local para guardar operaciones cuando no hay internet, y las sincroniza automáticamente al reconectar. Sin embargo, existen limitaciones importantes que el cajero debe conocer.

---

## 1. Arquitectura de Almacenamiento Local

### Dos bases de datos IndexedDB en el navegador

```
Navegador (PC del cajero)
├── LasPalmas_POS_Offline (v2)        ← Cola de transacciones pendientes
│   └── pending_sync (ObjectStore)
│       ├── ORDER         → Órdenes cobradas offline
│       ├── EXPENSE       → Gastos de caja offline
│       ├── CASH_INIT     → Apertura de turno offline
│       ├── CASH_CLOSE    → Cierre de turno offline
│       └── CREDIT_PAYMENT → Abonos a crédito offline
│
└── LasPalmas_POS_MasterData (v3)     ← Catálogo sincronizado al conectar
    ├── sections          → Áreas/secciones del restaurante
    ├── tables            → Configuración de mesas
    ├── products          → Productos del menú
    ├── categories        → Categorías de platillos
    ├── profiles          → Perfiles de usuarios
    ├── printers          → Configuración de impresoras
    ├── system_settings   → Configuración del sistema
    ├── roles             → Roles y permisos
    ├── branch_prices     → Precios por sucursal
    └── branch_inventory  → Inventario por sucursal
```

---

## 2. Motor de Sincronización (useOfflineSync.ts)

### Cuándo se activa la sincronización
| Disparador | Descripción |
|---|---|
| Evento `window.online` | Automático al recuperar internet |
| Evento `offline-sync-trigger` | Disparado internamente tras cada operación offline |
| Evento `manual-offline-sync` | Botón manual del usuario |
| Cada 60 segundos | Intervalo automático si hay conexión |

### Flujo de sincronización
```
Al reconectar Internet
  → Valida sesión Supabase (refresca si expira en < 5 minutos)
  → Obtiene todos los registros de pending_sync
  → Procesa cada uno secuencialmente:
      ORDER       → upsert en orders + order_items + invoices
      EXPENSE     → upsert en expenses
      CASH_INIT   → upsert en shifts
      CASH_CLOSE  → update en shifts
      CREDIT_PAY  → RPC register_credit_payment
  → Elimina el registro local si éxito
  → Incrementa retryCount si falla (y reintenta en siguiente ciclo)
```

---

## 3. Operaciones y su Comportamiento Offline

### ✅ FUNCIONA OFFLINE

| Operación | Comportamiento | Almacenamiento |
|---|---|---|
| **Ver mesas y secciones** | Carga desde MasterDataDB local | IndexedDB: `tables`, `sections` |
| **Ver menú / productos** | Carga desde MasterDataDB local | IndexedDB: `products`, `categories` |
| **Abrir turno de caja** | Guarda en IndexedDB, sincroniza al reconectar | `CASH_INIT` en pending_sync |
| **Comandar órdenes** | Guarda localmente con UUID generado | `ORDER` en pending_sync |
| **Cobrar sin factura FEL** | Marca `is_contingency = true` y guarda local | `ORDER` + `invoice` en pending_sync |
| **Cobrar con factura Contingencia** | Genera número `OFF-XXXX` temporal, guarda local | `ORDER` + `invoice` (series='CONT') |
| **Registrar gastos de caja** | Guarda en IndexedDB | `EXPENSE` en pending_sync |
| **Cierre de turno (Z)** | Guarda localmente | `CASH_CLOSE` en pending_sync |
| **Imprimir ticket / precuenta** | Funciona (impresora local, no necesita internet) | N/A |
| **Abrir cajón monedero** | Funciona (TCP local) | N/A |

### ⚠️ FUNCIONA CON LIMITACIONES

| Operación | Limitación |
|---|---|
| **Facturación FEL (SAT/INFILE)** | ❌ Requiere internet. Se usa modo contingencia automáticamente offline. La factura quedará pendiente de certificación. |
| **Reporte de ventas del día** | Muestra solo datos previamente cacheados, no tiempo real |
| **KDS (Pantalla de cocina)** | Si es online vía Supabase Realtime, no actualiza offline. Si es local via IP, sigue funcionando. |
| **Abono a crédito** | Se guarda local pero el balance del cliente no se actualiza en pantalla hasta sincronizar |

### ❌ NO FUNCIONA OFFLINE

| Operación | Razón |
|---|---|
| **Login inicial** | Requiere Supabase Auth para verificar credenciales |
| **Envío de correos (cierre Z)** | Requiere SMTP remoto |
| **Generar PDF de reportes** | El proceso de cierre usa datos de Supabase en tiempo real |
| **Sincronizar SAT** | Requiere API del certificador |
| **Consultar facturas emitidas** | Lee desde Supabase |

---

## 4. Flujo Offline de Cobro/Facturación (Checkout)

```
Cajero presiona "Cobrar" sin internet
  ↓
CheckoutView detecta !navigator.onLine
  ↓
Si cliente seleccionó FACTURA:
  → Se abre InvoiceModal con is_contingency = true automáticamente
  → Se genera número temporal: "OFF-[order_number]"
  → Se guarda: { series: 'CONT', document_number: 'OFF-XXX' }
  ↓
La orden se guarda en IndexedDB (pending_sync):
  → order: { status: 'completed', is_contingency: true, ... }
  → items: [...platillos]
  → invoice: { series: 'CONT', document_number: 'OFF-XXX', status: 'ACTIVE' }
  ↓
Se muestra alert: "✅ Venta guardada localmente. Se sincronizará al reconectar."
  ↓
Se imprime el ticket normalmente (impresora local)
  ↓
Al reconectar:
  → useOfflineSync procesa el ORDER
  → Sube la orden a Supabase
  → Sube la factura de contingencia (sin UUID de SAT)
  → La factura queda marcada como contingencia (requiere regularización posterior)
```

---

## 5. Apertura de Turno Offline

```javascript
// OpenShiftView.tsx - Línea 78
if (!navigator.onLine) {
    await offlineDB.saveRecord('CASH_INIT', shiftData);
    // Turno guardado localmente con UUID generado en cliente
    // Al reconectar → upsert en tabla shifts de Supabase
}
```

> **⚠️ Riesgo:** Si el cajero abre turno offline y luego otro cajero (con internet) también intenta abrir turno, podría haber conflicto. El `upsert` por ID evita duplicados pero el estado de la caja (`cash_registers`) no se actualiza hasta reconectar.

---

## 6. Cierre de Turno Offline

```javascript
// DashboardMain.tsx - Línea 321
if (!navigator.onLine) {
    // Se intenta obtener datos del turno desde caché local
    const offlineData = {
        closingData: {
            end_time: closingTime,
            end_amount: 0,        // ⚠️ DESCONOCIDO offline
            counted_amount: countedTotal,
            difference_amount: 0, // ⚠️ DESCONOCIDO offline
            ...
        }
    };
    await offlineDB.saveRecord('CASH_CLOSE', offlineData);
    // El corte Z queda pendiente de sincronización
}
```

> **⚠️ Limitación crítica:** El `end_amount` (monto final esperado) y `difference_amount` quedan en `0` offline porque no se pueden calcular las ventas sin acceso a Supabase. Al sincronizar, estos valores se actualizan pero la diferencia puede no ser exacta.

---

## 7. Detección y Señalización de Estado Offline

### En la UI del cajero
- **TableGrid:** Muestra banner "🔴 SIN CONEXIÓN" si `navigator.onLine === false`
- **useNetworkStatus hook:** Escucha eventos `online`/`offline` del navegador
- **useOfflineSync:** Expone `pendingCount` (número de registros pendientes)

### Indicador de pendientes
El sistema dispara `CustomEvent('offline-sync-count', { detail: count })` cada vez que actualiza el contador, permitiendo que cualquier componente muestre cuántas transacciones están en cola.

---

## 8. Tabla de Riesgos y Severidad

| Riesgo | Severidad | Descripción |
|---|---|---|
| **Factura FEL sin certificar** | 🔴 ALTA | Las facturas de contingencia deben regularizarse manualmente ante el SAT dentro del plazo legal |
| **end_amount = 0 en cierre offline** | 🟡 MEDIA | El arqueo puede mostrar diferencias incorrectas hasta sincronizar |
| **Login imposible si sesión expiró** | 🔴 ALTA | Si el cajero cierra sesión y no hay internet, no puede volver a entrar |
| **MasterDataDB desactualizada** | 🟡 MEDIA | Si no había internet previo, los productos/precios pueden estar desactualizados |
| **conflicto de caja registradora** | 🟡 MEDIA | Estado de cash_registers no actualiza offline |
| **Pérdida de datos por tab cerrada** | 🟢 BAJA | IndexedDB persiste aunque se cierre el navegador, pero no si se limpia caché |

---

## 9. Recomendaciones Operativas para el Cajero

> [!IMPORTANT]
> **Antes de perder internet** — Asegurarse de que el cajero haya iniciado sesión mientras había conexión. La sesión se renueva automáticamente por 5 horas.

> [!WARNING]
> **Facturas de contingencia** — Toda factura emitida offline queda como `CONT` sin UUID del SAT. Al reconectar, el sistema sube la factura a Supabase pero **NO la certifica automáticamente**. El administrador debe ir al visor de facturación y regularizarlas.

> [!TIP]
> **Actualizar datos maestros** — El mesero tiene botones "ACTUALIZAR CONFIGURACIÓN" y "ACTUALIZAR IMÁGENES" en su dashboard. Presionarlos mientras hay internet garantiza que el caché local esté al día para cuando se caiga la conexión.

---

## 10. Diagnóstico: Estado Actual del Sistema

```
✅ IndexedDB implementado y funcional
✅ Motor de sincronización automática al reconectar
✅ Cobro sin factura FEL: FUNCIONA offline
✅ Cobro con contingencia FEL: FUNCIONA offline (ticket imprime como CONT)
✅ Apertura de turno: FUNCIONA offline
✅ Cierre de turno: FUNCIONA offline (con limitación de montos)
✅ Gastos de caja: FUNCIONA offline
✅ Impresión (térmica/local): FUNCIONA offline
✅ Apertura cajón monedero: FUNCIONA offline (TCP local)
⚠️ Reportes en tiempo real: NO disponibles offline
⚠️ Facturación FEL certificada: NO disponible offline (contingencia sí)
❌ Login inicial: REQUIERE internet
❌ Envío de correos: REQUIERE internet
```

**Veredicto: El sistema puede operar con continuidad durante cortes de internet para las operaciones de caja del día a día. Las únicas restricciones críticas son el login inicial y la certificación FEL en tiempo real.**
