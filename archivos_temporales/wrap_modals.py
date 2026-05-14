import os
import re

directory = "c:/Users/CyR Las Palmas/Documents/Restaurante Las Palmas POS/components/admin"
files = [
    'BranchesAdmin.tsx', 'ConfigDelivery.tsx', 'ConfigDrivers.tsx', 'ConfigPrinters.tsx', 
    'ConfigReceivable.tsx', 'ConfigSoundsCard.tsx', 'ExpenseReportViewerModal.tsx',
    'ExpensesAdmin.tsx', 'InventoryLeveling.tsx', 'MenuAdmin.tsx', 'SectionsTablesAdmin.tsx',
    'ConfigDiscounts.tsx', 'ConfigWaiters.tsx', 'ConfigPlatforms.tsx', 'ConfigPosCard.tsx'
]

for filename in files:
    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    
    # ensure import
    import_added = any('DraggableWindow' in x for x in lines)

    in_modal = False
    div_depth = 0
    modal_div_found = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if not import_added and 'import { supabase }' in line:
            new_lines.append(line)
            new_lines.append("import { DraggableWindow } from './AdminPortal';\n")
            import_added = True
            i += 1
            continue
            
        if 'fixed inset-0 z-[99999]' in line:
            in_modal = True
            modal_div_found = False
            div_depth = 0
            new_lines.append(line)
            i += 1
            continue
            
        if in_modal:
            # We are waiting for the inner wrapper. Usually `<div className="absolute inset-0" ... />` is first.
            if not modal_div_found:
                if '<div' in line and ('absolute inset-0' in line or 'bg-transparent/10' in line) and ('/>' in line or '</div' in line):
                    new_lines.append(line)
                    # Next line should be the modal box start
                    new_lines.append("          <DraggableWindow>\n")
                    modal_div_found = True
                    div_depth = 0
                    i += 1
                    continue
                # Or if there is no absolute inset-0, maybe the first div IS the modal box.
                elif '<div className="bg-white' in line or '<div className="w-full' in line:
                    new_lines.append("          <DraggableWindow>\n")
                    new_lines.append(line)
                    modal_div_found = True
                    div_depth = line.count('<div') - line.count('</div')
                    
                    if div_depth == 0 and '</div' in line:
                        # closes on same line
                        new_lines.append("          </DraggableWindow>\n")
                        in_modal = False
                        
                    i += 1
                    continue
            else:
                # Normal counting
                div_depth += line.count('<div')
                div_depth -= line.count('</div')
                new_lines.append(line)
                
                if div_depth <= 0:
                    new_lines.append("          </DraggableWindow>\n")
                    in_modal = False
                    
                i += 1
                continue
                
        new_lines.append(line)
        i += 1
        
    if new_lines != lines:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Applied DraggableWindow wrap to {filename}")

