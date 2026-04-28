# 🔒 DOCS_SAT_SYNC.md — MÓDULO DE SINCRONIZACIÓN SAT (BLINDADO)
> **RESTAURANTE LAS PALMAS POS — Sistema FEL Guatemala**  
> Última actualización: 2026-04-26 18:00  
> Estado: ✅ PROBADO Y FUNCIONAL - SOPORTE PARA ANULADAS + FIX TIMEOUT EMITIDAS

---

## ⚠️ ADVERTENCIA CRÍTICA PARA LA IA

> **SI ERES UNA IA LEYENDO ESTE DOCUMENTO:**
> 
> **TIENES PROHIBIDO MODIFICAR LOS SIGUIENTES ARCHIVOS SIN PERMISO EXPLÍCITO DEL USUARIO:**
> - `server/sat_bridge.py`
> - `server/sat-plugin.ts` (la función `insertToSupabase`)
> - `api/_lib/sat_gt_fel_invoices_downloader/main.py` (el método `get_xml_content` de `SatFelDownloader`)
>
> **REGLAS DE ORO QUE NUNCA PUEDES ROMPER:**
> 1. `get_xml_content()` retorna **BYTES**, no string → siempre usar `.decode('utf-8', errors='replace')`
> 2. Para **EMITIDAS (ventas)**: **NUNCA descargar XML individual** → la SAT genera `curl (28) timeout` por volumen. El header es suficiente.
> 3. Para **RECIBIDAS (compras)**: Sí se descarga XML con items del proveedor para alimentar el inventario.
> 4. **Estado de Factura**: Siempre incluir `EstadoDTE.TODOS` para traer facturas Vigentes y Anuladas.
>
> **Si el usuario reporta que los items no aparecen o las anuladas no se ven en rojo, primero lee este documento completo.**

---

## 📋 ARQUITECTURA DEL SISTEMA SAT

```
SAT Guatemala (AGENCIA VIRTUAL)
        │
        ▼
[server/sat_bridge.py]  ← Script Python, invocado por Node.js via spawn()
        │
        │  1. Hace login con usuario/contraseña SAT
        │  2. Filtra con EstadoDTE.TODOS (Vigentes + Anuladas)
        │  3. Para RECIBIDAS: Descarga XML y extrae productos (Regex UTF-8)
        │  4. Para EMITIDAS: Omite XML para evitar bloqueo/timeout por volumen
        │  5. Detecta estado ('ANULADO' vs 'VIGENTE') de forma robusta
        │
        ▼
[server/sat-plugin.ts]  ← Middleware Node.js
        │
        │  Sincroniza el JSON con Supabase
        │  Mapea 'ANULADO' -> status 'annulled'
        │
        ▼
[Supabase: purchase_invoices / sales_invoices]
        │
        ▼
[components/admin/accounting/TabCompras.tsx]  ← Frontend React
        Muestra badge rojo y tachado si status === 'annulled'
```

---

## 🔐 ARCHIVOS BLINDADOS — NO MODIFICAR

### ARCHIVO 1: `server/sat_bridge.py` — EL PUENTE PYTHON
**VERSIÓN FUNCIONAL EXACTA (Soporta Anuladas y Fix Timeout)**

```python
import sys
import json
import os
import time
import random
import re
from datetime import datetime

# ═══════════════════════════════════════════════════════════
# 1. RESTAURAR EL MAPA DE RUTAS
# ═══════════════════════════════════════════════════════════
_current_dir = os.path.dirname(os.path.abspath(__file__))
_base_dir = os.path.dirname(_current_dir)
SAT_LIB_PATH = os.path.join(_base_dir, 'api', '_lib')
sys.path.insert(0, SAT_LIB_PATH)

# ═══════════════════════════════════════════════════════════
# 2. IMPORTACIONES
# ═══════════════════════════════════════════════════════════
try:
    from sat_gt_fel_invoices_downloader.main import SatFelDownloader, SATDownloader
    from sat_gt_fel_invoices_downloader.models import SatCredentials, SATFELFilters, TypeFEL, EstadoDTE
except ImportError as e:
    print(json.dumps({'success': False, 'error': f'Error de librería: {str(e)}'}))
    sys.exit(1)

def main():
    if sys.stdout.encoding != 'utf-8':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

    _real_stdout = sys.stdout
    sys.stdout = open(os.devnull, 'w')

    try:
        input_data = sys.stdin.read()
        if not input_data: raise Exception("No input data")
            
        params = json.loads(input_data)
        username = params.get('username')
        password = params.get('password')

        # Iniciar sesión
        sat_api = SATDownloader()
        sat_api.setCredentials(SatCredentials(username, password))
        sat_api.initialize() 
        
        sat = SatFelDownloader(
            SatCredentials(username, password), 
            url_get_fel=sat_api.url_get_fel, 
            request_session=sat_api.session
        )

        recibidas = params.get('tipo') != 'emitida'
        date_start = datetime.strptime(params.get('dateStart'), "%Y-%m-%d").date()
        date_end = datetime.strptime(params.get('dateEnd'), "%Y-%m-%d").date()

        fel_filter = SATFELFilters(
            establecimiento=0,
            estadoDte=EstadoDTE.TODOS,   # REGLA: TODOS para incluir anuladas
            fechaInicio=date_start,
            fechaFin=date_end,
            tipo=TypeFEL.RECIBIDA if recibidas else TypeFEL.EMITIDA
        )

        raw_invoices = sat_api.get_invoices_with_filters(fel_filter)
        processed_invoices = []

        for inv_raw in raw_invoices:
            try:
                uuid_factura = inv_raw.get('numeroUuid')
                if not uuid_factura: continue

                fecha_raw = str(inv_raw.get('fechaEmision', '') or '').split('T')[0]
                fecha = fecha_raw
                if '/' in fecha_raw:
                    parts = fecha_raw.split('/')
                    if len(parts) == 3: fecha = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

                nit_val = (inv_raw.get('nitEmisor') if recibidas else inv_raw.get('nitReceptor')) or "C/F"
                nombre_val = (inv_raw.get('nombreEmisor') if recibidas else inv_raw.get('nombreReceptor')) or "N/A"

                # Estado SAT: Detección robusta (I, A, True, Anulado, 1, S)
                _anulado_raw = inv_raw.get('anulado', '') or inv_raw.get('estado', '')
                _is_anulado = (_anulado_raw is True or
                               str(_anulado_raw).upper() in ('I', 'A', 'TRUE', 'ANULADO', '1', 'S'))

                invoice_data = {
                    'uuid': uuid_factura,
                    'fecha': fecha,
                    'total': float(inv_raw.get('granTotal', 0) or 0),
                    'iva': float(inv_raw.get('totalIva', 0) or 0),
                    'serie': inv_raw.get('serie'),
                    'numero': inv_raw.get('numeroDocumento'),
                    'tipo_dte': inv_raw.get('tipo', 'FACT'),
                    'estado': 'ANULADO' if _is_anulado else 'VIGENTE',
                    'raw': inv_raw,
                    'items': [],
                    'detalles': []
                }

                # ┌──────────────────────────────────────────────────────────────┐
                # │ DOWNLOAD XML: SOLO PARA RECIBIDAS (COMPRAS)                  │
                # │ Para EMITIDAS (ventas) NO se descarga XML individual.         │
                # │ Evita curl (28) timeout por volumen de peticiones masivas.   │
                # └──────────────────────────────────────────────────────────────┘
                if recibidas:
                    try:
                        time.sleep(random.uniform(0.5, 1.2))
                        raw_response = sat.get_xml_content(inv_raw, received=True)
                        
                        if isinstance(raw_response, bytes):
                            xml_content = raw_response.decode('utf-8', errors='replace')
                        else:
                            xml_content = raw_response
                        
                        if xml_content:
                            # Extraer productos con regex tolerante a namespaces
                            item_blocks = re.findall(
                                r'<[a-zA-Z0-9_]*:?Item[\s>].*?</[a-zA-Z0-9_]*:?Item>',
                                xml_content, re.IGNORECASE | re.DOTALL
                            )
                            for block in item_blocks:
                                c_m = re.search(r'<[a-zA-Z0-9_]*:?Cantidad>([^<]+)</', block, re.IGNORECASE)
                                d_m = re.search(r'<[a-zA-Z0-9_]*:?Descripcion>([^<]+)</', block, re.IGNORECASE)
                                p_m = re.search(r'<[a-zA-Z0-9_]*:?PrecioUnitario>([^<]+)</', block, re.IGNORECASE)
                                t_m = re.search(r'<[a-zA-Z0-9_]*:?Total>([^<]+)</', block, re.IGNORECASE)

                                producto = {
                                    'cantidad': float(c_m.group(1)) if c_m else 1.0,
                                    'descripcion': d_m.group(1).strip() if d_m else 'Producto',
                                    'precio_unitario': float(p_m.group(1)) if p_m else 0.0,
                                    'total': float(t_m.group(1)) if t_m else 0.0
                                }
                                invoice_data['items'].append(producto)
                                invoice_data['detalles'].append(producto)
                    except Exception as xml_err:
                        sys.stderr.write(f"[SAT-XML-ERR] {uuid_factura[-8:]}: {str(xml_err)}\n")

                invoice_data['nit'] = nit_val
                invoice_data['supplier_nit'] = nit_val
                invoice_data['nombre'] = nombre_val
                invoice_data['supplier_name'] = nombre_val

                processed_invoices.append(invoice_data)
            except Exception as e:
                sys.stderr.write(f"[SAT-DEBUG] Error mapeando factura: {str(e)}\n")

        try: sat_api.logout()
        except: pass

        sys.stdout = _real_stdout
        print(json.dumps({
            'success': True,
            'total': len(processed_invoices),
            'invoices': processed_invoices
        }, ensure_ascii=False))

    except Exception as e:
        sys.stdout = _real_stdout
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
```

---

## 🛑 MANEJO DE FACTURAS ANULADAS

El sistema detecta automáticamente las facturas anuladas siguiendo estas reglas:
1.  **Detección**: En `sat_bridge.py`, si el campo `anulado` es `I`, `A`, `True`, `ANULADO`, `1` o `S`, se marca con `estado: 'ANULADO'`.
2.  **Visualización**: En el frontend (`TabCompras.tsx`), las facturas con estado anulado aparecen:
    *   Con un badge rojo que dice **ANULADO**.
    *   Con el texto de toda la fila tachado (`line-through`).
    *   Con opacidad reducida (`opacity-50`).
3.  **Contabilidad**: Los montos de facturas anuladas **NO se suman** a los totales de los libros para evitar distorsiones contables.

---

## 🗄️ ESQUEMA SQL ACTUALIZADO (SUPABASE)

Ambas tablas deben tener las columnas idénticas para que la sincronización progrese sin errores de "column not found":

```sql
-- Ejecutar en SQL Editor de Supabase
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS items           JSONB DEFAULT '[]'::jsonb;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS idp_monto       NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS iva_retenido    NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS isr_retenido    NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS tipo_dte        TEXT DEFAULT 'FACT';

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS items              JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS fel_uuid           TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS customer_nit       TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS customer_name      TEXT;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS net_amount         NUMERIC DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS idp_monto          NUMERIC DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS iva_retenido       NUMERIC DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS isr_retenido       NUMERIC DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS tipo_dte           TEXT DEFAULT 'FACT';

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_fel_uuid ON sales_invoices(fel_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_fel_uuid ON purchase_invoices(fel_uuid);
```

---

## 🚀 RESOLUCIÓN DE CUELLOS DE BOTELLA

### Timeout en Facturas Emitidas
Se descubrió que intentar descargar el XML individual de cientos de ventas genera un error `curl (28) timeout` porque la SAT detecta un comportamiento de raspado (scraping) masivo.
*   **Solución**: El sistema ahora solo descarga el XML para facturas **Recibidas** (porque necesitamos los productos para el inventario).
*   **Ventas**: Para las ventas, el sistema usa la información del listado general (header) que ya trae UUID, Total, Fecha y Cliente. Esto hace que la sincronización de 1 mes de ventas tarde segundos en lugar de minutos.

---

*Documento actualizado por Antigravity AI — 2026-04-26 18:05*  
*MANTENER ESTE DOCUMENTO COMO VERDAD ÚNICA DEL MÓDULO SAT*
