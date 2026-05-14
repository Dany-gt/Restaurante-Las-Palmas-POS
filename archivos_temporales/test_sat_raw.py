
import sys
import os
import json

lib_path = os.path.abspath(os.path.join(os.getcwd(), 'api', '_lib'))
sys.path.insert(0, lib_path)

from sat_gt_fel_invoices_downloader.main import SATDownloader
class Credentials:
    def __init__(self, u, p):
        self.username = u
        self.password = p

sat = SATDownloader()
sat.setCredentials(Credentials("91887666", "Laspalmas2015"))

from datetime import date
d = date(2026, 4, 3)
invoices = sat.get_invoices(d, d, received=False)

for inv in invoices:
    total = str(inv.get('granTotal', ''))
    if '231' in total:
        print(f"FOUND INVOICE 231: {inv.get('nombreReceptor')} - Total: {total} - UUID: {inv.get('numeroUuid')} - Estado: {inv.get('estado')}")
        print(json.dumps(inv, indent=2))
