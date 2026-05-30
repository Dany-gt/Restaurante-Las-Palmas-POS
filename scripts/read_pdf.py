import PyPDF2
import sys

def read_pdf(file_path):
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ''
            for page in reader.pages:
                text += page.extract_text() + '\n'
            print(text)
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)

read_pdf(r"C:\Users\CyR Las Palmas\Desktop\Documents\Cierre.pdf")
