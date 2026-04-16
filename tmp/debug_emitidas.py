import sys
import os
import json
import logging
from datetime import datetime, date

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Add the lib path at the START of sys.path
lib_path = os.path.abspath(os.path.join(os.getcwd(), 'api', '_lib'))
sys.path.insert(0, lib_path)

try:
    from sat_gt_fel_invoices_downloader.main import SATDownloader
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

class Credentials:
    def __init__(self, u, p):
        self.username = u
        self.password = p

def debug_sync():
    username = "91887666"
    password = "Laspalmas2015"
    # Convert to date objects
    date_start = date.fromisoformat("2026-04-01")
    date_end = date.fromisoformat("2026-04-04")
    received = False # Sales (Emitidas)
    
    print(f"--- DEBUG SYNC (EMITIDAS) ---")
    print(f"Period: {date_start} to {date_end}")
    
    try:
        sat = SATDownloader().setCredentials(Credentials(username, password))
        print("Logging in to SAT...")
        sat.initialize()
        print("Login to SAT successful.")
        
        print("Fetching headers...")
        invoices_raw = sat.get_invoices(date_start, date_end, received=received)
        print(f"Found {len(invoices_raw)} invoices raw.")
        
        # Turbo Sync Processing (Header only)
        invoices = []
        for inv_raw in invoices_raw:
            try:
                # Fast processing matching sat-sync.py
                total = float(inv_raw.get('granTotal') or 0)
                inv_processed = {
                    'uuid': inv_raw.get('numeroUuid'),
                    'total': total,
                    'nombre': inv_raw.get('nombreReceptor') or "N/A",
                    'tipo': inv_raw.get('tipoDte')
                }
                invoices.append(inv_processed)
                print(f"Processed: {inv_processed['uuid']} - {inv_processed['nombre']} - Q{inv_processed['total']}")
            except Exception as e:
                print(f"Error processing item: {e}")

        print(f"TOTAL PROCESSED: {len(invoices)}")
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_sync()
