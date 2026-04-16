import os
import sys
import json
import datetime
import base64
import traceback
import threading
import concurrent.futures
from http.server import BaseHTTPRequestHandler
import logging

# Intentar importar requests aquí para ver si falla
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError as e:
    requests = None
    BeautifulSoup = None
    import_error = str(e)
else:
    import_error = None

# ═══════════════════════════════════════════════════════════
# Cargar la librería SAT FEL ubicada en api/_lib (AISLADO)
# ═══════════════════════════════════════════════════════════
# Path local para evitar que Vercel incluya toda la raíz del proyecto
current_dir = os.path.dirname(os.path.abspath(__file__))
SAT_LIB_PATH = os.path.join(current_dir, '_lib')
if SAT_LIB_PATH not in sys.path:
    sys.path.insert(0, SAT_LIB_PATH)

lib_import_error = None
try:
    from sat_gt_fel_invoices_downloader import SATDownloader
    from sat_gt_fel_invoices_downloader.models import SatCredentials
except ImportError as e:
    SATDownloader = None
    lib_import_error = str(e)

CATEGORIES = [
    'Materia prima cocina', 'Materia prima cevichería', 'Materia prima bebidas',
    'Gas y energía', 'Limpieza y desechables', 'Mantenimiento',
    'Servicios profesionales', 'Otros'
]

def auto_categorize(name):
    if not name: return 'Otros'
    s = name.lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    if any(k in s for k in ['gas', 'electric', 'energuate', 'eegsa', 'tropig', 'z-gas', 'empresa elec', 'solar', 'energi']): return 'Gas y energía'
    if any(k in s for k in ['platic', 'desechable', 'limpieza', 'detergent', 'jabon', 'bolsa', 'quimic', 'higienico', 'servilleta']): return 'Limpieza y desechables'
    if any(k in s for k in ['bebid', 'pepsi', 'coca', 'cerveza', 'brava', 'gallito', 'agua pura', 'hielo', 'licor', 'ron ', 'aguas', 'vodka']): return 'Materia prima bebidas'
    if any(k in s for k in ['ceviche', 'marisco', 'camaron', 'pescado', 'concha', 'ostra', 'marina']): return 'Materia prima cevichería'
    if any(k in s for k in ['ferreter', 'pintur', 'vidrio', 'mader', 'taller', 'mantenim', 'herramient', 'reparacion']): return 'Mantenimiento'
    if any(k in s for k in ['contad', 'auditor', 'abogad', 'notari', 'asesor', 'seguridad', 'consultor', 'oficin']): return 'Servicios profesionales'
    if any(k in s for k in ['pollo', 'carne', 'carnicer', 'embutid', 'huevo', 'pan ', 'tortilla', 'verdur', 'frut', 'abarrot', 'unisuper', 'la torre', 'supermerca']): return 'Materia prima cocina'
    return 'Otros'

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Health check para verificar que el endpoint funciona
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        info = {
            'status': 'online',
            'import_error': import_error,
            'lib_import_error': lib_import_error,
            'lib_path': SAT_LIB_PATH,
            'python_version': sys.version,
            'lib_exists': os.path.exists(SAT_LIB_PATH)
        }
        self.wfile.write(json.dumps(info).encode())

    def do_POST(self):
        try:
            if import_error or lib_import_error:
                raise Exception(f"Import Error: {import_error or lib_import_error}")

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            params = json.loads(post_data)

            username = params.get('username')
            password = params.get('password')
            date_start_str = params.get('dateStart')
            date_end_str = params.get('dateEnd')
            tipo = params.get('tipo', 'recibida')
            supa_url = params.get('supabaseUrl')
            supa_key = params.get('supabaseKey')
            gemini_key = params.get('geminiKey')

            # 1. SAT Bridge
            action = params.get('action', 'sync')
            
            credentials = SatCredentials(username, password)
            sat = SATDownloader()
            sat.setCredentials(credentials)

            # ─────────────────────────────────────────────────────────
            # ACCIÓN: DESCARGA DE DOCUMENTOS (PDF/XML)
            # ─────────────────────────────────────────────────────────
            if action == 'download':
                uuid = params.get('uuid')
                nit = params.get('nit')
                amount = float(params.get('total', 0) or 0)
                format_ext = params.get('format', 'pdf')
                
                # Mock invoice dict for the library
                inv_search = {
                    'numeroUuid': uuid,
                    'nitEmisor': nit,
                    'granTotal': amount
                }
                
                if format_ext == 'pdf':
                    content = sat.get_pdf_content(inv_search)
                else:
                    content = sat.get_xml_content(inv_search)
                
                b64 = base64.b64encode(content).decode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'content': b64,
                    'filename': f"{uuid}.{format_ext}"
                }).encode())
                return

            # ─────────────────────────────────────────────────────────
            # ACCIÓN: SINCRONIZACIÓN (NORMAL)
            # ─────────────────────────────────────────────────────────
            date_start = datetime.date.fromisoformat(date_start_str)
            date_end = datetime.date.fromisoformat(date_end_str)
            recibidas = (tipo == 'recibida')
            
            # Descargar de SAT (esto es lo que más tarda)
            invoices_raw = sat.get_invoices(date_start, date_end, received=recibidas)
            invoices = []
            
            # --- FUNCIÓN PARA PROCESAR DETALLE (XML) EN PARALELO ---
            # --- FUNCIÓN PARA PROCESAR CABECERAS (RÁPIDO) ---
            def process_fast(inv_raw):
                try:
                    total = float(inv_raw.get('granTotal') or 0)
                    iva = float(inv_raw.get('montoIva') or 0)
                    fecha_raw = str(inv_raw.get('fechaEmision', '') or '')
                    fecha = fecha_raw.split('T')[0]
                    if '/' in fecha:
                        parts = fecha.split('/')
                        if len(parts) == 3: fecha = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

                    nombre = (inv_raw.get('nombreEmisor') if recibidas else inv_raw.get('nombreReceptor')) or "N/A"
                    nit = (inv_raw.get('nitEmisor') if recibidas else inv_raw.get('nitReceptor')) or "C/F"

                    return {
                        'nit': nit, 'nombre': nombre, 'fecha': fecha,
                        'total': total, 'iva': iva,
                        'serie': inv_raw.get('serie'), 'numero': inv_raw.get('numero'),
                        'uuid': inv_raw.get('numeroUuid'), 'tipo_dte': inv_raw.get('tipoDte'),
                        'estado': inv_raw.get('estadoDte', 'V'), # V=vigente, A=anulado
                        'raw': inv_raw # Guardamos para el background thread
                    }
                except: return None
            # ------------------------------------------------------

            # Procesar Cabeceras (Instantáneo)
            invoices = []
            for inv in invoices_raw:
                res = process_fast(inv)
                if res: invoices.append(res)

            # --- Sincronizar Retenciones Recibidas (Scraping de Agencia Virtual) ---
            if recibidas:
                try:
                    retenciones = sat.get_constancias_retencion(date_start, date_end)
                    for ret in retenciones:
                        invoices.append({
                            'nit_emisor': ret['nit_emisor'],
                            'nombre_emisor': ret['nombre_emisor'],
                            'fecha': ret['fecha'],
                            'total': ret['total'],
                            'iva': 0,
                            'serie': ret['serie'],
                            'numero': ret['numero'],
                            'uuid': ret['uuid'],
                            'tipo_dte': 'CRE',
                            'estado': 'V',
                            'isr_retenido': ret['isr_retenido'],
                            'iva_retenido': ret['iva_retenido'],
                            'detail': f"Retención: {ret['numero']}"
                        })
                except Exception as e:
                    import logging
                    logging.error(f"Error sincronizando retenciones: {str(e)}")
            # -------------------------------------------------------------------------

            # 2. Categorization
            # 2. Categorization
            if tipo == 'recibida':
                for inv in invoices:
                    inv['category'] = auto_categorize(inv['nombre'])
            else:
                for inv in invoices: inv['category'] = 'Venta Facturada'

            # 3. Supabase Sync
            imported = 0
            if supa_url and supa_key and invoices:
                table = 'sales_invoices' if tipo == 'emitida' else 'purchase_invoices'
                headers = { 'apikey': supa_key, 'Authorization': f'Bearer {supa_key}', 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
                
                records = []
                for inv in invoices:
                    # Mapeo inicial de cabeceras (Turbo Sync)
                    final_desc = f"Sincronizado: {inv['tipo_dte']} - {inv['nombre']}"

                    # Asegurar que invoice_number no sea nulo (Requerido por Supabase en sales_invoices)
                    serie = inv.get('serie') or ""
                    numero = inv.get('numero') or ""
                    inv_num = f"{serie}-{numero}".strip("-") if (serie or numero) else inv['uuid'][:15]
                    if not inv_num: inv_num = inv['uuid']

                    rec = {
                        'org_id': 'default', 'invoice_date': inv['fecha'],
                        'invoice_number': inv_num,
                        'description': final_desc, 'total_amount': inv['total'], 'iva_amount': inv['iva'],
                        'net_amount': inv['total'] - inv['iva'], 'category': inv.get('category', 'Otros'),
                        'fel_uuid': inv['uuid'], 'status': 'Anulado' if inv['estado'] == 'A' else 'paid',
                        'tipo_dte': inv['tipo_dte'], 'isr_retenido': inv.get('isr_retenido', 0), 'iva_retenido': inv.get('iva_retenido', 0)
                    }

                    if tipo == 'emitida':
                        rec['customer_nit'] = inv['nit']; rec['customer_name'] = inv['nombre']
                    else:
                        rec['supplier_nit'] = inv['nit']; rec['supplier_name'] = inv['nombre']
                    records.append(rec)

                if records:
                    # Enviar a Supabase en bloques más pequeños (100) para mayor confiabilidad
                    batch_size = 100
                    for k in range(0, len(records), batch_size):
                        batch = records[k:k+batch_size]
                        try:
                            # Log para depuración
                            logging.info(f"Syncing batch {k//batch_size + 1}: {len(batch)} records to {table}")
                            res = requests.post(f"{supa_url}/rest/v1/{table}?on_conflict=fel_uuid", headers=headers, json=batch, timeout=45)
                            
                            if res.ok: 
                                imported += len(batch)
                            elif res.status_code == 400 and 'column' in res.text.lower():
                                # ERROR DE ESQUEMA: Intentar limpiar el lote de columnas sospechosas 
                                # (esto suele pasar si sales_invoices no ha sido nivelada)
                                logging.warning(f"Schema mismatch detected in {table}. Retrying without extra columns.")
                                clean_batch = []
                                for r in batch:
                                    # Columnas que sabemos que pueden faltar en sales_invoices
                                    c_rec = r.copy()
                                    for col in ['tipo_dte', 'isr_retenido', 'iva_retenido', 'customer_nit', 'customer_name']:
                                        if col in c_rec: del c_rec[col]
                                    clean_batch.append(c_rec)
                                
                                res_retry = requests.post(f"{supa_url}/rest/v1/{table}?on_conflict=fel_uuid", headers=headers, json=clean_batch, timeout=30)
                                if res_retry.ok:
                                    imported += len(clean_batch)
                                    logging.info(f"Batch {k//batch_size + 1} recovered successfully (without extra columns).")
                                else:
                                    logging.error(f"Failed even after cleanup: {res_retry.text}")
                            else:
                                logging.error(f"Error Supabase: {res.status_code} - {res.text}")
                        except Exception as e:
                            logging.error(f"Exc Supabase: {str(e)}")

                    
                    # --- LANZAR ENRIQUECIMIENTO EN SEGUNDO PLANO (PHASE 2) ---
                    if recibidas and len(invoices) > 0:
                        logging.info(f"Starting bg enrichment for {len(invoices)} purchases")
                        def background_enrichment(items_to_process, s_url, s_key, s_table):
                            try:
                                h = { 'apikey': s_key, 'Authorization': f'Bearer {s_key}', 'Content-Type': 'application/json' }
                                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as enrich_exec:
                                    def enrich_one(inv_obj):
                                        try:
                                            # Solo enriquecer si es una compra (recibida)
                                            model = sat.get_model(inv_obj['raw'])
                                            lines = [f"{int(l.quantity)} {l.description}" for l in model.lines]
                                            detail = f"{len(lines)} PRODUCTOS: {', '.join(lines)[:160]}"
                                            new_desc = f"Turbo Sync SAT: {detail}"
                                            requests.patch(f"{s_url}/rest/v1/{s_table}?fel_uuid=eq.{inv_obj['uuid']}", headers=h, json={'description': new_desc}, timeout=15)
                                        except: pass
                                    enrich_exec.map(enrich_one, items_to_process)
                            except Exception as bg_e:
                                logging.error(f"Bg Error: {str(bg_e)}")

                        thread = threading.Thread(target=background_enrichment, args=(invoices, supa_url, supa_key, table))
                        thread.daemon = True
                        thread.start()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'total': len(invoices),
                'imported': imported
            }).encode())

        except Exception as e:
            self.send_response(200) 
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False, 
                'error': str(e),
                'traceback': traceback.format_exc()
            }).encode())
