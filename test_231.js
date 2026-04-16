const fs = require('fs');
const { execSync } = require('child_process');

const pyscript = `
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
    if total == '231.0' or total == '231':
        print(f"FOUND INVOICE 231: {inv.get('nombreReceptor')} - UUID {inv.get('numeroUuid')}")
        print("Raw JSON:")
        print(json.dumps(inv, indent=2))
`;

fs.writeFileSync('test_sat_raw.py', pyscript);
console.log(execSync('python test_sat_raw.py').toString());
