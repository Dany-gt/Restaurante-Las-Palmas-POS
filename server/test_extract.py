from bs4 import BeautifulSoup
import re

with open(r"C:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\server\login_response.html", "r", encoding="utf-8") as f:
    text = f.read()

parser = BeautifulSoup(text, features="html.parser")

dtelink = None
for a_tag in parser.find_all("a"):
    if "Consultar DTE" in str(a_tag):
        print("FOUND using str:", a_tag)
        dtelink = a_tag
        break

if not dtelink:
    print("Not found by str")
    
if dtelink and 'onclick' in dtelink.attrs:
    onclick_text = dtelink["onclick"]
    match = re.search(r'\{name:"url",value:"([^"]+)"\}', onclick_text)
    if match:
        raw_url = match.group(1)
        dte_link = raw_url.replace('\\/', '/').replace('\\-', '-')
        print("EXTRAIDO OK:", dte_link)
    else:
        print("No match")
