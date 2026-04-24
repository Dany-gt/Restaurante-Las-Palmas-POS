import os
import re

directory = r'c:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\components\admin'

# Matches the standard title div in admin panels: <div><h2>Title</h2><p>Subtitle</p></div>
pattern = re.compile(r'<div>\s*<h[23][^>]*>.*?</h[23]>\s*(?:<p[^>]*>.*?</p>\s*)?</div>', re.DOTALL)

for filename in os.listdir(directory):
    if filename.endswith('.tsx') and filename not in ['MenuAdmin.tsx', 'AdminPortal.tsx']:
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content, count = pattern.subn('<div className="flex-1"></div>', content, count=1)
        
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
        else:
            print(f"Skipped {filename} - Pattern not found")
