import sys
import os
import traceback

_base_dir = os.path.dirname(os.path.abspath(__file__))
SAT_LIB_PATH = os.path.join(_base_dir, 'lib')
sys.path.insert(0, SAT_LIB_PATH)

from sat_gt_fel_invoices_downloader import SATDownloader
from sat_gt_fel_invoices_downloader.models import SatCredentials
import datetime

# Usar credenciales falsas pero formateadas correctamente para ver donde se quiebra
# O intentar login
try:
    print("Iniciando test de librería SAT...")
    sat = SATDownloader()
    
    # Credenciales temporales para ver si pasa o si al menos falla dentro del flujo
    credentials = SatCredentials("12345678", "ClaveMala123")
    sat.setCredentials(credentials)
    
    # Intentar obtener facturas.
    # El método get_invoices internamente hace doLogin() y luego getMenu()
    d_start = datetime.date.today() - datetime.timedelta(days=2)
    d_end = datetime.date.today()
    invoices = sat.get_invoices(d_start, d_end, received=True)
    print("Éxito!")
except Exception as e:
    print("Falló con el siguiente traceback:")
    traceback.print_exc()
