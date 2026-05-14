import os
import re

directory = "c:/Users/CyR Las Palmas/Documents/Restaurante Las Palmas POS/components/admin"
files = [f for f in os.listdir(directory) if f.endswith('.tsx')]

pattern_zindex = re.compile(r'fixed\s+inset-0\s+z-\[\d+\]')

for filename in files:
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if there's any z-index to update
    if pattern_zindex.search(content):
        # Update z-index to 99999
        new_content = pattern_zindex.sub('fixed inset-0 z-[99999]', content)
        
        # Also remove overflow-hidden from the fixed overlay if it exists
        # E.g. 'fixed inset-0 z-[99999] overflow-hidden'
        new_content = re.sub(r'(fixed\s+inset-0\s+z-\[99999\].*?)overflow-hidden', r'\1', new_content)

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated z-index in {filename}")

