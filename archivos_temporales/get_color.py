
import os
import glob
from PIL import Image

brain_dir = r"C:\Users\CyR Las Palmas\.gemini\antigravity\brain\4e6b9b55-daef-45bd-9ea7-64d0bf20784e"
# Find the latest png
list_of_files = glob.glob(os.path.join(brain_dir, '*.png'))
latest_file = max(list_of_files, key=os.path.getctime)

print(f"Analyzing {latest_file}")
with Image.open(latest_file) as img:
    img = img.convert('RGB')
    # Let's check a pixel safely in the top blue bar, like x=200, y=10
    r, g, b = img.getpixel((200, 10))
    hex_color = '#{:02x}{:02x}{:02x}'.format(r, g, b)
    print(f"Top bar color: {hex_color} (RGB: {r}, {g}, {b})")
    
    # Check bottom bar around x=200, y=height-10
    r2, g2, b2 = img.getpixel((200, img.height - 10))
    hex_color2 = '#{:02x}{:02x}{:02x}'.format(r2, g2, b2)
    print(f"Bottom bar color: {hex_color2}")
