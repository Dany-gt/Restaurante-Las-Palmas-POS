"""
SAT Bridge Script — Las Palmas POS
Descarga facturas FEL recibidas de la SAT de Guatemala y las retorna como JSON.
Recibe parámetros via stdin (JSON) y escribe el resultado a stdout.
"""
import sys
import json
import datetime
import os
import logging

# Forzar UTF-8 en Windows para evitar caracteres rotos ()
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════════
# Suprimir TODA salida stdout de la librería SAT
# (la librería tiene print() en actions.py y main.py)
# ═══════════════════════════════════════════════════════════
_real_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')
logging.disable(logging.CRITICAL)

# Agregar la librería SAT al path (ubicada en api/_lib)
# Usamos la ubicación superior para apuntar a api/_lib
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAT_LIB_PATH = os.path.join(_base_dir, 'api', '_lib')
sys.path.insert(0, SAT_LIB_PATH)

try:
    from sat_gt_fel_invoices_downloader import SATDownloader
    from sat_gt_fel_invoices_downloader.models import SatCredentials
except ImportError as e:
    sys.stdout = _real_stdout
    print(json.dumps({
        'success': False,
        'error': f'No se encontró la librería SAT en {SAT_LIB_PATH}. Error: {str(e)}'
    }))
    sys.exit(1)


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


def main():
    # Leer parámetros de stdin
    sys.stdout = _real_stdout
    try:
        raw_input = sys.stdin.read()
        params = json.loads(raw_input)
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Error leyendo parámetros: {str(e)}'}))
        return

    username = params.get('username', '')
    password = params.get('password', '')
    date_start_str = params.get('dateStart', '')
    date_end_str = params.get('dateEnd', '')
    supa_url = params.get('supabaseUrl')
    supa_key = params.get('supabaseKey')

    if not username or not password or not date_start_str or not date_end_str:
        print(json.dumps({'success': False, 'error': 'Faltan parámetros críticos'}))
        return

    # Parsear fechas
    try:
        date_start = datetime.date.fromisoformat(date_start_str)
        date_end = datetime.date.fromisoformat(date_end_str)
    except ValueError as e:
        print(json.dumps({'success': False, 'error': f'Formato de fecha inválido: {str(e)}'}))
        return

    # Suprimir stdout de nuevo para la librería
    sys.stdout = open(os.devnull, 'w')

    try:
        sys.stderr.write("DEBUG: Conectando con SAT...\n")
        credentials = SatCredentials(username, password)
        sat = SATDownloader()
        sat.setCredentials(credentials)

        tipo = params.get('tipo', 'recibida')
        recibidas = (tipo == 'recibida')

        # PASO 1: Obtener la lista de facturas (Headers)
        only_retenciones = params.get('onlyRetenciones', False)
        invoices_raw = []
        
        if not only_retenciones:
            sys.stderr.write(f"DEBUG: Descargando facturas ({date_start} a {date_end})\n")
            invoices_raw = sat.get_invoices(date_start, date_end, received=recibidas)
        
        from concurrent.futures import ThreadPoolExecutor

        def process_invoice(inv_raw):
            try:
                total = float(inv_raw.get('granTotal', 0) or 0)
                fecha_raw = str(inv_raw.get('fechaEmision', '') or '').split('T')[0]
                
                fecha = fecha_raw
                if '/' in fecha_raw:
                    parts = fecha_raw.split('/')
                    if len(parts) == 3: fecha = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

                nombre = (inv_raw.get('nombreEmisor') if recibidas else inv_raw.get('nombreReceptor')) or "N/A"
                nit = (inv_raw.get('nitEmisor') if recibidas else inv_raw.get('nitReceptor')) or "C/F"

                return {
                    'nit': nit, 'nombre': nombre, 'fecha': fecha,
                    'total': total, 'iva': float(inv_raw.get('totalIva', 0) or 0),
                    'serie': inv_raw.get('serie'), 'numero': inv_raw.get('numeroDocumento'),
                    'uuid': inv_raw.get('numeroUuid'), 'tipo_dte': inv_raw.get('tipo', 'FACT'),
                    'estado': 'A' if inv_raw.get('anulado') == 'I' else 'V',
                    'raw': inv_raw
                }
            except: return None

        # Procesar Cabeceras
        invoices = []
        if invoices_raw:
            for inv in invoices_raw:
                res = process_invoice(inv)
                if res: invoices.append(res)

        # Incluir retenciones si es Recibida
        if recibidas:
            try:
                sys.stderr.write("DEBUG: Buscando retenciones...\n")
                retenciones = sat.get_constancias_retencion(date_start, date_end)
                for ret in retenciones:
                    invoices.append({
                        'nit': ret['nit_emisor'], 'nombre': ret['nombre_emisor'],
                        'fecha': ret['fecha'], 'total': ret['total'], 'iva': 0,
                        'serie': ret['serie'], 'numero': ret['numero'], 'uuid': ret['uuid'],
                        'tipo_dte': 'CRE', 'estado': 'V',
                        'isr_retenido': ret['isr_retenido'], 'iva_retenido': ret['iva_retenido']
                    })
            except: pass

        # 2. Categorización
        for inv in invoices:
            inv['category'] = auto_categorize(inv['nombre']) if recibidas else 'Venta Facturada'

        # 3. Sincronización con Supabase (Directa desde Python Local)
        imported = 0
        if supa_url and supa_key and invoices:
            table = 'sales_invoices' if tipo == 'emitida' else 'purchase_invoices'
            headers = { 'apikey': supa_key, 'Authorization': f'Bearer {supa_key}', 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
            
            records = []
            for inv in invoices:
                inv_num = f"{inv['serie']}-{inv['numero']}".strip("-") if (inv['serie'] or inv['numero']) else inv['uuid'][:15]
                rec = {
                    'org_id': 'default', 'invoice_date': inv['fecha'], 'invoice_number': inv_num,
                    'description': f"Turbo Sync SAT: {inv['nombre']}", 'total_amount': inv['total'], 
                    'iva_amount': inv['iva'], 'net_amount': inv['total'] - inv['iva'], 
                    'category': inv['category'], 'fel_uuid': inv['uuid'], 
                    'status': 'annulled' if inv['estado'] == 'A' else 'paid',
                    'tipo_dte': inv['tipo_dte'], 'isr_retenido': inv.get('isr_retenido', 0), 
                    'iva_retenido': inv.get('iva_retenido', 0)
                }
                if tipo == 'emitida':
                    rec['customer_nit'] = inv['nit']; rec['customer_name'] = inv['nombre']
                else:
                    rec['supplier_nit'] = inv['nit']; rec['supplier_name'] = inv['nombre']
                    rec['payment_status'] = 'paid'
                records.append(rec)

            if records:
                import requests
                sys.stderr.write(f"DEBUG: Sincronizando {len(records)} registros con Supabase...\n")
                batch_size = 100
                for k in range(0, len(records), batch_size):
                    batch = records[k:k+batch_size]
                    try:
                        res_supa = requests.post(f"{supa_url}/rest/v1/{table}?on_conflict=fel_uuid", headers=headers, json=batch, timeout=60)
                        if res_supa.ok: imported += len(batch)
                    except: pass

        # Cerrar sesión SAT
        try: sat.logout()
        except: pass

        # Restaurar stdout y escribir resultado final esperado por React
        sys.stdout = _real_stdout
        print(json.dumps({
            'success': True,
            'total': len(invoices),
            'imported': imported
        }, ensure_ascii=False))

    except Exception as e:
        sys.stdout = _real_stdout
        import traceback
        error_msg_full = f"{str(e)}\n{traceback.format_exc()}"
        sys.stderr.write(f"DEBUG EXCEPTION: {error_msg_full}\n")
        
        error_msg = str(e)
        if 'credentials' in error_msg.lower() or 'not valid' in error_msg.lower():
            error_msg = 'Credenciales SAT inválidas. Verifique su usuario y contraseña de Agencia Virtual.'
        elif 'timeout' in error_msg.lower() or 'connection' in error_msg.lower():
            error_msg = 'No se pudo conectar con el servidor de la SAT. Intente de nuevo más tarde.'
        print(json.dumps({'success': False, 'error': error_msg}))


if __name__ == '__main__':
    main()
