import sys
import os
from datetime import date

# Add the lib path
sys.path.insert(0, os.path.abspath('api/_lib'))

from sat_gt_fel_invoices_downloader.main import SATDownloader
from sat_gt_fel_invoices_downloader.models import SATFELFilters, TypeFEL, EstadoDTE

class Creds:
    username = "91887666"
    password = "Laspalmas2015"

def get_one():
    try:
        sat = SATDownloader().setCredentials(Creds())
        sat.initialize()
        # Fetching for April 1st only to be fast
        invs = sat.get_invoices(date(2026,4,1), date(2026,4,1), received=False)
        if invs:
            print(f"FOUND: {len(invs)}")
            # Sort to get a recent one or first
            print("--- FIRST INVOICE DATA ---")
            import json
            print(json.dumps(invs[0], indent=2))
        else:
            print("NONE FOUND")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    get_one()
