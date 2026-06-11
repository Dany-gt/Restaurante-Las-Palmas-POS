---
trigger: on-demand
description: Implementa un DataGrid con Auto-Filter Row interactivo estilo DevExpress / Windows Classic.
---

# DevExpress Auto-Filter DataGrid Standard

**Cuándo usarlo:** Cuando el usuario pida aplicar el filtro tipo DevExpress, "el listado como lo dejaste", o "filtro de datagrid clásico" en una tabla. Para invocar este comando, puedes llamarlo como `/devexpress-grid-filter` o simplemente solicitar el estándar.

## 1. Características Visuales
- Fila de cabecera (`thead`) estática y con colores institucionales (fondo `#f0f0f0`, texto slate-800, `text-[11px] font-bold`).
- Fila inmediatamente inferior (`tr` secundaria en el `thead`) dedicada exclusivamente a los inputs de "Auto-Filtro".
- **Inputs transparentes:** Los cuadros de texto de búsqueda DEBEN tener `bg-transparent border-none outline-none` para que parezca que la celda es editable, sin bordes de input web.

## 2. Lógica del Auto-Filtro
Se debe implementar un menú contextual absoluto sobre el ícono de filtro para la columna principal (ej. Nombre) con las opciones matemáticas clásicas.

```tsx
// Estados necesarios
const [pickerSearch, setPickerSearch] = useState('');
const [pickerMinSearch, setPickerMinSearch] = useState('');
const [pickerMaxSearch, setPickerMaxSearch] = useState('');
const [pickerFilterType, setPickerFilterType] = useState('Contiene');
const [showPickerFilterMenu, setShowPickerFilterMenu] = useState(false);

// Cerrar menú globalmente
useEffect(() => {
    const handleClick = () => setShowPickerFilterMenu(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
}, []);
```

## 3. Lógica de Filtrado (Array.filter)
```typescript
const pickerFilteredGroups = optionGroups.filter(g => {
    let matchName = true;
    if (pickerSearch) {
        const name = g.name.toLowerCase();
        const search = pickerSearch.toLowerCase();
        switch (pickerFilterType) {
            case 'Igual': matchName = name === search; break;
            case 'No es igual': matchName = name !== search; break;
            case 'Contiene': matchName = name.includes(search); break;
            case 'No contiene': matchName = !name.includes(search); break;
            case 'Comienza con': matchName = name.startsWith(search); break;
            case 'Acaba con': matchName = name.endsWith(search); break;
            case 'Es mayor que': matchName = name > search; break;
            case 'Es mayor o igual que': matchName = name >= search; break;
            case 'Es menor que': matchName = name < search; break;
            case 'Es menor o igual que': matchName = name <= search; break;
            default: matchName = name.includes(search);
        }
    }
    if (!matchName) return false;

    // Filtros secundarios directos (Contiene parcial)
    if (pickerMinSearch && !String(g.min_selection ?? 0).includes(pickerMinSearch)) return false;
    if (pickerMaxSearch && !String(g.max_selection ?? 1).includes(pickerMaxSearch)) return false;

    return true;
});
```

## 4. Estructura UI de la Fila de Filtro (JSX)
```tsx
<tr className="h-6 border-b border-gray-300 bg-white">
    <td className="px-1 border-r border-gray-300">
        <div className="flex items-center gap-1 text-slate-500 font-bold px-1 text-[10px] relative">
            <span 
                onClick={(e) => { e.stopPropagation(); setShowPickerFilterMenu(!showPickerFilterMenu); }}
                className="w-5 h-5 flex items-center justify-center border border-gray-300 rounded-[2px] bg-[#f8f8f8] cursor-pointer hover:bg-gray-200 text-[#106ebe] text-[10px]" 
            >
                {pickerFilterType === 'Igual' ? '=' : 
                 pickerFilterType === 'No es igual' ? '≠' : 
                 pickerFilterType === 'Contiene' ? 'a' : 
                 pickerFilterType === 'No contiene' ? '!a' : 
                 pickerFilterType === 'Comienza con' ? 'a*' : 
                 pickerFilterType === 'Acaba con' ? '*a' : 
                 pickerFilterType === 'Es mayor que' ? '>' : 
                 pickerFilterType === 'Es mayor o igual que' ? '≥' : 
                 pickerFilterType === 'Es menor que' ? '<' : 
                 pickerFilterType === 'Es menor o igual que' ? '≤' : <ListFilter size={10} />}
            </span>
            {showPickerFilterMenu && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-300 shadow-lg z-50 py-1 font-normal text-left">
                    {[
                        { label: 'Igual', icon: '=' }, 
                        { label: 'No es igual', icon: '≠' }, 
                        { label: 'Contiene', icon: 'a' }, 
                        { label: 'No contiene', icon: '!a' }, 
                        { label: 'Comienza con', icon: 'a*' }, 
                        { label: 'Acaba con', icon: '*a' },
                        { label: 'Es mayor que', icon: '>' },
                        { label: 'Es mayor o igual que', icon: '≥' },
                        { label: 'Es menor que', icon: '<' },
                        { label: 'Es menor o igual que', icon: '≤' }
                    ].map(type => (
                        <div 
                            key={type.label}
                            onClick={(e) => { e.stopPropagation(); setPickerFilterType(type.label); setShowPickerFilterMenu(false); }}
                            className={`px-2 py-1.5 cursor-pointer hover:bg-[#106ebe] hover:text-white flex items-center gap-2 ${pickerFilterType === type.label ? 'bg-blue-50 text-[#106ebe]' : 'text-slate-700'}`}
                        >
                            <span className="w-4 text-center font-bold text-[10px] text-green-600 group-hover:text-white">{type.icon}</span>
                            <span className={pickerFilterType === type.label ? 'font-bold' : ''}>{type.label}</span>
                        </div>
                    ))}
                </div>
            )}
            <input 
                type="text" 
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="w-full h-5 bg-transparent border-none outline-none text-[10px] px-1 text-black font-normal" 
                placeholder="Buscar..."
            />
        </div>
    </td>
    {/* Columnas Secundarias sin Menú de Filtro Avanzado */}
    <td className="px-1 border-r border-gray-300">
        <div className="flex items-center gap-1 text-slate-500 font-bold px-1 text-[10px]">
            <input 
                type="text" 
                value={pickerMinSearch}
                onChange={e => setPickerMinSearch(e.target.value)}
                className="w-full h-5 bg-transparent border-none outline-none text-[10px] px-1 text-black font-normal text-center" 
            />
        </div>
    </td>
</tr>
```

## Resumen de Reglas Clave:
1. Siempre usar `bg-transparent border-none outline-none` en los text inputs del auto-filtro.
2. Manejar correctamente `e.stopPropagation()` al hacer clic en las opciones del menú para evitar desencadenar eventos de filas padre o cerrar el menú erróneamente.
3. Actualizar dinámicamente el ícono de la regla matemática (`=`, `a*`, `<`, etc.) cuando cambia el estado.
