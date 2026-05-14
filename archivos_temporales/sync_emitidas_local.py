"""
Script LOCAL para sincronizar facturas EMITIDAS de SAT directo a Supabase.
Evita el timeout de Vercel ejecutándose directamente desde la máquina local.
"""
import sys
import os
import json
import logging
import requests
from datetime import datetime, date

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Add the lib path
lib_path = os.path.abspath(os.path.join(os.getcwd(), 'api', '_lib'))
sys.path.insert(0, lib_path)

try:
    from sat_gt_fel_invoices_downloader.main import SATDownloader
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# ── CONFIG ──────────────────────────────────────────────────
SAT_USERNAME = "91887666"
SAT_PASSWORD = "Laspalmas2015"
SUPABASE_URL = "https://cofdsbczmrkriohlgyct.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY"

# ── FECHAS (AJUSTAR AQUÍ) ──────────────────────────────────
DATE_START = "2026-03-01"
DATE_END   = "2026-04-05"
# ────────────────────────────────────────────────────────────

class Credentials:
    def __init__(self, u, p):
        self.username = u
        self.password = p

def sync_emitidas():
    date_start = date.fromisoformat(DATE_START)
    date_end = date.fromisoformat(DATE_END)

    print("=" * 60)
    print(f"  SYNC FACTURAS EMITIDAS: {DATE_START} a {DATE_END}")
    print("=" * 60)

    # 1. Login y descarga de cabeceras
    log.info("Conectando a SAT...")
    sat = SATDownloader()
    sat.setCredentials(Credentials(SAT_USERNAME, SAT_PASSWORD))
    
    log.info("Descargando facturas emitidas...")
    invoices_raw = sat.get_invoices(date_start, date_end, received=False)
    log.info(f"Descargadas: {len(invoices_raw)} facturas")

    if not invoices_raw:
        log.warning("No se encontraron facturas emitidas en el rango.")
        return

    # 2. Procesar cabeceras (igual que sat-sync.py)
    records = []
    for inv_raw in invoices_raw:
        try:
            total = float(inv_raw.get('granTotal') or 0)
            iva = float(inv_raw.get('totalIva') or 0)
            fecha_raw = str(inv_raw.get('fechaEmision', '') or '')
            fecha = fecha_raw.split('T')[0]
            if '/' in fecha:
                parts = fecha.split('/')
                if len(parts) == 3:
                    fecha = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

            nombre = inv_raw.get('nombreReceptor') or "C/F"
            nit = inv_raw.get('nitReceptor') or "C/F"

            serie = inv_raw.get('serie') or ""
            numero = inv_raw.get('numeroDocumento') or ""
            uuid = inv_raw.get('numeroUuid')
            inv_num = f"{serie}-{numero}".strip("-") if (serie or numero) else uuid[:15]
            if not inv_num:
                inv_num = uuid

            estado = 'A' if inv_raw.get('anulado') == 'I' else 'V'
            tipo_dte = inv_raw.get('tipo', 'FACT')
            desc = f"Sincronizado: {tipo_dte} - {nombre}"

            rec = {
                'org_id': 'default',
                'invoice_date': fecha,
                'invoice_number': inv_num,
                'description': desc,
                'total_amount': total,
                'iva_amount': iva,
                'net_amount': total - iva,
                'category': 'Venta Facturada',
                'fel_uuid': uuid,
                'status': 'annulled' if estado == 'A' else 'paid',
                'tipo_dte': tipo_dte,
                'isr_retenido': 0,
                'iva_retenido': 0,
                'customer_nit': nit,
                'customer_name': nombre
            }
            records.append(rec)
        except Exception as e:
            log.error(f"Error procesando factura: {e}")

    log.info(f"Procesadas: {len(records)} facturas listas para Supabase")

    # 3. Enviar a Supabase en lotes
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }

    imported = 0
    errors = 0
    batch_size = 50
    total_batches = (len(records) + batch_size - 1) // batch_size

    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        try:
            res = requests.post(
                f"{SUPABASE_URL}/rest/v1/sales_invoices?on_conflict=fel_uuid",
                headers=headers,
                json=batch,
                timeout=30
            )

            if res.ok:
                imported += len(batch)
                log.info(f"  ✅ Lote {batch_num}/{total_batches}: {len(batch)} registros OK")
            else:
                errors += len(batch)
                log.error(f"  ❌ Lote {batch_num}/{total_batches}: {res.status_code} - {res.text[:200]}")
        except Exception as e:
            errors += len(batch)
            log.error(f"  ❌ Lote {batch_num}/{total_batches}: {str(e)}")

    # 4. Resumen
    print()
    print("=" * 60)
    print(f"  RESUMEN")
    print(f"  Total descargadas:  {len(invoices_raw)}")
    print(f"  Importadas OK:      {imported}")
    print(f"  Errores:            {errors}")
    print("=" * 60)

if __name__ == "__main__":
    sync_emitidas()
