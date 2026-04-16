import re
import sys

def modify_file():
    filepath = r'c:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\components\admin\MenuAdmin.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Update overall padding and modal width
    code = code.replace(
        'max-w-[950px] bg-slate-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans border border-slate-200"',
        'max-w-[1000px] bg-slate-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans border border-slate-200"'
    )

    code = code.replace(
        '<div className="bg-white border-b border-slate-200 flex justify-between items-center px-8 py-5">',
        '<div className="bg-white border-b border-slate-200 flex justify-between items-center px-6 py-4">'
    )

    code = code.replace(
        '<div className="p-8 flex flex-col gap-6 overflow-y-auto max-h-[80vh] custom-scrollbar">',
        '<div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[85vh] custom-scrollbar">'
    )

    code = code.replace(
        '<div className="flex flex-col flex-1 admin-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">',
        '<div className="flex flex-col flex-1 admin-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[220px]">'
    )

    # 2. Re-write the Left: Input Fields section completely
    old_left_section = re.search(r'\{/\* Left: Input Fields \*/\}.*?\{/\* Right: Image Panel \*/\}', code, re.DOTALL)
    if old_left_section:
        new_left = """{/* Left: Input Fields */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="admin-card p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                       Datos Generales
                    </h4>
                    
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Código</label>
                        <input 
                          value={newProduct.product_code} 
                          onChange={e => setNewProduct({ ...newProduct, product_code: e.target.value })} 
                          placeholder="Ej. PLT-01"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Plato (Nombre Completo)</label>
                        <input 
                          value={newProduct.name} 
                          onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                          placeholder="Ej. Ceviche de Camarón"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Nombre Corto</label>
                        <input 
                          value={newProduct.short_name} 
                          onChange={e => setNewProduct({ ...newProduct, short_name: e.target.value })} 
                          placeholder="Ej. Ceviche Cam"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Precio Costo</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-slate-400">Q</span>
                          <input 
                            type="number" step="0.01"
                            value={newProduct.cost_price} 
                            placeholder="0.00"
                            onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold focus:border-indigo-500 focus:bg-white transition-all outline-none"
                          />
                        </div>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Prioridad</label>
                        <input 
                          type="number" 
                          value={newProduct.priority} 
                          onChange={e => setNewProduct({ ...newProduct, priority: e.target.value })} 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none text-center"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Categoría</label>
                        <select 
                          value={newProduct.category_id} 
                          onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })} 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none appearance-none"
                        >
                          <option value="">Seleccionar...</option>
                          {categories.filter(c => !c.parent_id).map(parent => (
                            <React.Fragment key={parent.id}>
                              <option value={parent.id} className="font-bold">★ {parent.name}</option>
                              {categories.filter(c => c.parent_id === parent.id).map(sub => (
                                <option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>
                              ))}
                            </React.Fragment>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Cocina</label>
                        <select 
                          value={newProduct.kitchen_station_id} 
                          onChange={e => setNewProduct({ ...newProduct, kitchen_station_id: e.target.value })} 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none appearance-none"
                        >
                          <option value="">Ninguna</option>
                          {kitchens.map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 block ml-1">Descripción</label>
                      <textarea 
                        value={newProduct.description} 
                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
                        placeholder="Descripción de los ingredientes o preparación..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:bg-white transition-all outline-none h-[42px] resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Image Panel */}"""
        code = code[:old_left_section.start()] + new_left + code[old_left_section.end() - 28:]
    else:
        print("Left section not found")
        return

    # 3. Optimize Photo right panel
    code = code.replace(
        'className="w-[240px] flex flex-col gap-4 shrink-0"',
        'className="w-[180px] flex flex-col gap-3 shrink-0"'
    )
    code = code.replace(
        'admin-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center h-full"',
        'admin-card bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center h-full"'
    )
    code = code.replace(
        'group h-[180px]"',
        'group h-[100px]"'
    )
    code = code.replace(
        'px-4 text-center">Subir Imagen<br/><span className="text-[8px] opacity-70">(Auto-recorte)</span></span>',
        'px-2 text-center">Subir Imagen</span>'
    )
    code = code.replace(
        '<ImageIcon size={40} className="opacity-50" />',
        '<ImageIcon size={24} className="opacity-50" />'
    )

    # 4. Global Prices Removal & Tabs
    # Remove Middle Section mapping
    old_middle = re.search(r'\{/\* Middle Section: Global Prices \*/\}.*?\{/\* Bottom Section: Tabs \*/\}', code, re.DOTALL)
    if old_middle:
        code = code[:old_middle.start()] + '{/* Bottom Section: Tabs */}' + code[old_middle.end()-28:]
    else:
        print("Middle section not found")

    # Tabs reduction
    code = code.replace(
        'px-6 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all rounded-full',
        'px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-full'
    )

    # Inject Global Prices into branches Tab
    tabs_content = re.search(r"\{activeTab === 'branches' && \(\s*<div className=\"flex-1 overflow-auto custom-scrollbar p-0\">\s*<table", code, re.DOTALL)
    if tabs_content:
        new_tabs = """{activeTab === 'branches' && (
                    <div className="flex-1 overflow-hidden flex flex-col relative">
                      {/* Condensed Global Fast Setup inside Tab */}
                      <div className="bg-indigo-50/50 p-2.5 border-b border-indigo-100 flex items-center justify-between gap-4 shrink-0">
                         <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest ml-2">Configuración Rápida (Todas)</span>
                         </div>
                         <div className="flex items-center gap-3 flex-1 justify-end">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Salón:</span>
                              <div className="relative w-20">
                                <span className="absolute inset-y-0 left-1.5 flex items-center text-[9px] font-bold text-indigo-400">Q</span>
                                <input type="number" step="0.01" value={globalPrices.price} onChange={e => setGlobalPrices({...globalPrices, price: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-md pl-4 pr-1 py-1 text-[10px] font-bold text-slate-800 text-center outline-none" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Domicilio:</span>
                              <div className="relative w-20">
                                <span className="absolute inset-y-0 left-1.5 flex items-center text-[9px] font-bold text-indigo-400">Q</span>
                                <input type="number" step="0.01" value={globalPrices.delivery_price} onChange={e => setGlobalPrices({...globalPrices, delivery_price: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-md pl-4 pr-1 py-1 text-[10px] font-bold text-slate-800 text-center outline-none" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Plataformas:</span>
                              <div className="relative w-20">
                                <span className="absolute inset-y-0 left-1.5 flex items-center text-[9px] font-bold text-indigo-400">Q</span>
                                <input type="number" step="0.01" value={globalPrices.platform_price} onChange={e => setGlobalPrices({...globalPrices, platform_price: e.target.value})} className="w-full bg-white border border-indigo-200 rounded-md pl-4 pr-1 py-1 text-[10px] font-bold text-slate-800 text-center outline-none" />
                              </div>
                            </div>
                            <button onClick={() => { setBranchPrices(branchPrices.map(bp => ({...bp, price: globalPrices.price || bp.price, delivery_price: globalPrices.delivery_price || bp.delivery_price, platform_price: globalPrices.platform_price || bp.platform_price }))); }} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-4 py-1.5 font-bold uppercase tracking-widest text-[9px] shadow-sm ml-2 transition-all active:scale-95">
                              Aplicar 👇
                            </button>
                         </div>
                      </div>
                      <div className="flex-1 overflow-auto custom-scrollbar"><table"""
        code = code[:tabs_content.start()] + new_tabs + code[tabs_content.end()-6:]
    else:
        print("Tabs content not found")

    # 5. Table rows height
    code = code.replace('py-4 px-6 border-b', 'py-2 px-4 border-b text-[9px]')
    code = code.replace('py-4 px-4 border-b', 'py-2 px-3 border-b text-[9px]')
    code = code.replace('py-3 px-6 font-semibold', 'py-1 px-4 font-semibold text-xs')
    code = code.replace('pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all', 'pl-5 pr-1 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:border-indigo-500 focus:bg-white outline-none transition-all')

    code = code.replace('py-2 px-3">\n                                  <div', 'py-1 px-3">\n                                  <div')
    code = code.replace('py-2 px-4 text-center', 'py-1 px-4 text-center')
    code = code.replace('py-2 px-6 text-center', 'py-1 px-6 text-center')

    # 6. Bottom spacing
    code = code.replace('pt-4 border-t border-slate-200 mt-2', 'pt-3 border-t border-slate-200 shrink-0 mt-0')
    code = code.replace('py-3 rounded-xl font-black uppercase tracking-widest text-[11px]', 'py-2 rounded-lg font-black uppercase tracking-widest text-[11px]')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

    print("Success")

if __name__ == '__main__':
    modify_file()
