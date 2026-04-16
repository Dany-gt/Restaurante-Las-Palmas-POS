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

    if not username or not password or not date_start_str or not date_end_str:
        print(json.dumps({'success': False, 'error': 'Faltan parámetros: username, password, dateStart, dateEnd'}))
        return

    # Parsear fechas
    try:
        date_start = datetime.date.fromisoformat(date_start_str)
        date_end = datetime.date.fromisoformat(date_end_str)
    except ValueError as e:
        print(json.dumps({'success': False, 'error': f'Formato de fecha inválido (use YYYY-MM-DD): {str(e)}'}))
        return

    # Suprimir stdout de nuevo para la librería
    sys.stdout = open(os.devnull, 'w')

    try:
        sys.stderr.write("DEBUG: Conectando con credenciales...\n")
        credentials = SatCredentials(username, password)
        sat = SATDownloader()
        sat.setCredentials(credentials)

        tipo = params.get('tipo', 'recibida')
        recibidas = (tipo == 'recibida')

        # PASO 1: Obtener la lista de facturas (Headers) - Método rápido y muy confiable
        only_retenciones = params.get('onlyRetenciones', False)
        invoices_raw = []
        
        if not only_retenciones:
            sys.stderr.write(f"DEBUG: Obteniendo headers de SAT ({date_start} a {date_end}, recibidas={recibidas})...\n")
            invoices_raw = sat.get_invoices(date_start, date_end, received=recibidas)
            sys.stderr.write(f"DEBUG: Headers obtenidos: {len(invoices_raw)}\n")
        else:
            sys.stderr.write(f"DEBUG: Modo exclusivo RETENCIONES activo. Saltando headers FEL.\n")

        from concurrent.futures import ThreadPoolExecutor

        def process_invoice(inv_raw):
            try:
                # PASO 2: Para compras (recibidas), pedir el modelo detallado (XML) 
                # para obtener los productos (items). Para emitidas, omitirlo por rapidez.
                items = []
                if recibidas:
                    inv_model = sat.get_model(inv_raw)
                    # Serializar líneas de productos si existen
                    if hasattr(inv_model, 'lines'):
                        for line in inv_model.lines:
                            items.append({
                                'cantidad': line.quantity,
                                'descripcion': line.description,
                                'precio_unitario': line.unit_price,
                                'total': line.total,
                                'descuento': line.discount,
                                'numero_linea': line.line_number,
                                'bien_o_servicio': line.good_or_service
                            })

                # Datos básicos del resumen (usando los keys del objeto inv_raw)
                total = float(inv_raw.get('granTotal', 0) or 0)
                fecha_raw = str(inv_raw.get('fechaEmision', '') or '').strip()
                
                # Formatear fecha (YYYY-MM-DD)
                fecha = fecha_raw
                if '/' in fecha_raw:
                    parts = fecha_raw.split('/')
                    if len(parts) == 3:
                        if len(parts[2]) == 4: fecha = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                        elif len(parts[0]) == 4: fecha = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif 'T' in fecha_raw:
                    fecha = fecha_raw.split('T')[0]

                return {
                    'nit_emisor': inv_raw.get('nitEmisor') if recibidas else inv_raw.get('nitReceptor'),
                    'nombre_emisor': inv_raw.get('nombreEmisor') if recibidas else inv_raw.get('nombreReceptor'),
                    'nombre_comercial': inv_raw.get('nombreComercialEmisor') if recibidas else inv_raw.get('nombreReceptor'),
                    'fecha': fecha,
                    'total': total,
                    'iva': float(inv_raw.get('totalIva', 0) or 0),
                    'neto': total - float(inv_raw.get('totalIva', 0) or 0),
                    'serie': inv_raw.get('serie'),
                    'numero': inv_raw.get('numeroDocumento'),
                    'uuid': inv_raw.get('numeroUuid'),
                    'estado': 'ANULADO' if inv_raw.get('anulado') == 'I' else 'V',
                    'tipo_dte': inv_raw.get('tipo'),
                    'items': items
                }
            except Exception:
                # Si falla una individual (ej. no hay XML), intentamos guardar al menos el resumen
                try:
                    total = float(inv_raw.get('granTotal', 0) or 0)
                    return {
                        'uuid': inv_raw.get('numeroUuid'),
                        'serie': inv_raw.get('serie'),
                        'numero': inv_raw.get('numeroDocumento'),
                        'total': total,
                        'nit_emisor': inv_raw.get('nitEmisor') if recibidas else inv_raw.get('nitReceptor'),
                        'nombre_emisor': inv_raw.get('nombreEmisor') if recibidas else inv_raw.get('nombreReceptor'),
                        'estado': 'ANULADO' if inv_raw.get('anulado') == 'I' else 'V',
                        'tipo_dte': inv_raw.get('tipo'),
                        'items': [] # Sin detalle por error de descarga
                    }
                except:
                    return None

        # PASO 2: Procesar en paralelo (Turbo MODE)
        results = []
        action = params.get('action', 'sync')

        if action == 'retenciones_pdf':
            num = params.get('numero')
            tipo_ret = params.get('tipoRetencion', 'IVA')
            
            pdf_bin = sat.get_retencion_pdf(num, date_start, date_end, tipo_ret)
            if not pdf_bin:
                sys.stdout = _real_stdout
                print(json.dumps({'success': False, 'error': 'No se pudo descargar el PDF de la retención'}))
                return
            
            import base64
            sys.stdout = _real_stdout
            print(json.dumps({
                'success': True,
                'pdf_base64': base64.b64encode(pdf_bin).decode('utf-8'),
                'filename': f"retencion_{num}.pdf"
            }))
            return

        if action == 'retenciones_sync':
             # Sincronizar solo retenciones
             retenciones = sat.get_constancias_retencion(date_start, date_end)
             sys.stdout = _real_stdout
             print(json.dumps({'success': True, 'count': len(retenciones), 'invoices': retenciones}))
             return

        if invoices_raw:
            with ThreadPoolExecutor(max_workers=20) as executor:
                # Filtrar Nones
                results = [r for r in executor.map(process_invoice, invoices_raw) if r is not None]

        # Incluir retenciones si es Recibida
        if recibidas:
            try:
                retenciones = sat.get_constancias_retencion(date_start, date_end)
                for ret in retenciones:
                    results.append({
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
                        'iva_retenido': ret['iva_retenido']
                    })
            except: pass

        # Cerrar sesión SAT
        try:
            sat.logout()
        except:
            pass

        # Restaurar stdout y escribir resultado
        sys.stdout = _real_stdout
        print(json.dumps({
            'success': True,
            'count': len(results),
            'invoices': results
        }, ensure_ascii=False))

    except Exception as e:
        sys.stdout = _real_stdout
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        sys.stderr.write(f"DEBUG EXCEPTION: {error_msg}\n")
        
        error_msg = str(e)
        if 'credentials' in error_msg.lower() or 'not valid' in error_msg.lower():
            error_msg = 'Credenciales SAT inválidas. Verifique su usuario y contraseña de Agencia Virtual.'
        elif 'timeout' in error_msg.lower() or 'connection' in error_msg.lower():
            error_msg = 'No se pudo conectar con el servidor de la SAT. Intente de nuevo más tarde.'
        print(json.dumps({'success': False, 'error': error_msg}))


if __name__ == '__main__':
    main()
