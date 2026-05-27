import React, { useState, useEffect } from 'react';
import { Plus, Grid, Layout, Users, Trash2, Edit2, Loader2, X } from 'lucide-react';
import { DraggableWindow } from './AdminPortal';
import { supabase } from '../../supabase';

export const TablesAdmin: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', section: '', capacity: '4' });
  const [bulkConfig, setBulkConfig] = useState({ count: '5', startNumber: '1', capacity: '4', section: '' });
  const [editingTable, setEditingTable] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [tablesRes, sectionsRes] = await Promise.all([
      supabase.from('tables').select('*').neq('status', 'deleted').order('number'),
      supabase.from('sections').select('*').order('name')
    ]);

    if (!tablesRes.error) setTables(tablesRes.data || []);
    if (!sectionsRes.error) {
      setSections(sectionsRes.data || []);
      if (sectionsRes.data && sectionsRes.data.length > 0) {
        if (!newTable.section) setNewTable(prev => ({ ...prev, section: sectionsRes.data[0].name }));
        if (!bulkConfig.section) setBulkConfig(prev => ({ ...prev, section: sectionsRes.data[0].name }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa del sistema?')) return;

    // Soft delete
    const { error } = await supabase
      .from('tables')
      .update({ status: 'deleted' })
      .eq('id', id);

    if (!error) {
      fetchData();
    } else {
      console.error("Soft delete failed", error);
      alert("Error al eliminar la mesa: " + error.message);
    }
  };

  const handleEdit = (table: any) => {
    setEditingTable(table);
    setNewTable({
      number: table.number.toString(),
      section: table.section,
      capacity: table.capacity.toString()
    });
    setBulkMode(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTable(null);
    setNewTable({ number: '', section: '', capacity: '4' });
  };

  const handleSave = async () => {
    if (bulkMode) {
      const start = parseInt(bulkConfig.startNumber);
      const count = parseInt(bulkConfig.count);
      const capacity = parseInt(bulkConfig.capacity);
      const tablesToInsert = [];

      for (let i = 0; i < count; i++) {
        const num = start + i;
        tablesToInsert.push({
          id: `t-${num}`,
          number: num,
          section: bulkConfig.section,
          capacity: capacity,
          status: 'available'
        });
      }

      const { error } = await supabase.from('tables').insert(tablesToInsert);
      if (!error) {
        setShowModal(false);
        fetchData();
      } else {
        alert('Error en creación masiva: ' + error.message);
      }
    } else {
      if (!newTable.number) return;
      
      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            section: newTable.section,
            capacity: parseInt(newTable.capacity)
          })
          .eq('id', editingTable.id);

        if (!error) {
          handleCloseModal();
          fetchData();
        } else {
          alert('Error: ' + error.message);
        }
      } else {
        const id = `t-${newTable.number}`;
        const { error } = await supabase.from('tables').insert([{
          id: id,
          number: parseInt(newTable.number),
          section: newTable.section,
          capacity: parseInt(newTable.capacity),
          status: 'available'
        }]);
        if (!error) {
          handleCloseModal();
          fetchData();
        } else {
          alert('Error: ' + error.message);
        }
      }
    }
  };

  return (
    <div className="p-6 animate-fade-in w-full h-full flex flex-col relative bg-[#f8f9fc]">
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => { setEditingTable(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 px-5 py-2.5 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg active:scale-95 transition-all"
        >
          <Plus size={16} /> AGREGAR MESA
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-12">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>
        ) : (
          sections.map(section => {
            const sectionTables = tables.filter(t => t.section === section.name);
            return (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-4 border-b border-gray-200 pb-2">
                  <h3 className="text-lg font-black uppercase text-indigo-600 tracking-tighter">{section.name}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded-full">{sectionTables.length} Mesas</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 px-2">
                  {sectionTables.map((table) => (
                    <div 
                      key={table.id} 
                      onDoubleClick={() => handleEdit(table)}
                      className="bg-white p-6 rounded-2xl relative group border border-gray-200 hover:border-indigo-500/30 transition-all flex flex-col items-center shadow-sm hover:shadow-md cursor-pointer select-none"
                    >
                      <div className="absolute top-4 right-4 flex gap-1 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(table); }} className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-500 hover:text-indigo-600 shadow-sm transition-all active:scale-90"><Edit2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(table.id); }} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 hover:text-red-600 shadow-sm transition-all active:scale-90"><Trash2 size={12} /></button>
                      </div>
                      <span className="text-4xl font-black tracking-tighter block mb-2 text-gray-900">{table.number}</span>
                      <div className="flex flex-col gap-1 items-center">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Users size={12} />
                          <span className="text-[10px] font-bold text-slate-400">Capacidad: {table.capacity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sectionTables.length === 0 && <p className="text-xs text-slate-500 col-span-full">Sin mesas registradas en esta área.</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
          <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={handleCloseModal} />
          <DraggableWindow id="tables-admin-modal" title={editingTable ? 'Editar Mesa' : 'Mantenimiento de Mesas'}>
            <div className="w-full max-w-md bg-white rounded-sm p-8 border border-gray-300 shadow-2xl pointer-events-auto relative">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black uppercase text-gray-900">{editingTable ? 'Editar Mesa' : 'Agregar Mesa'}</h3>
                <button onClick={handleCloseModal} className="text-slate-500 hover:text-slate-750"><X size={24} /></button>
              </div>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-8">
                <button
                  onClick={() => setBulkMode(false)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!bulkMode ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-400 hover:text-gray-900'}`}
                  disabled={!!editingTable}
                >
                  Individual
                </button>
                <button
                  onClick={() => setBulkMode(true)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-400 hover:text-gray-900'}`}
                  disabled={!!editingTable}
                >
                  Creación Masiva
                </button>
              </div>

              <div className="space-y-6">
                {!bulkMode ? (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Número de Mesa</label>
                      <input 
                        value={newTable.number} 
                        onChange={e => setNewTable({ ...newTable, number: e.target.value })} 
                        type="number" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" 
                        placeholder="Ej. 1"
                        disabled={!!editingTable}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sección / Área</label>
                      <select value={newTable.section} onChange={e => setNewTable({ ...newTable, section: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                        {sections.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Capacidad (Personas)</label>
                      <input value={newTable.capacity} onChange={e => setNewTable({ ...newTable, capacity: e.target.value })} type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="4" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cant. Mesas</label>
                        <input value={bulkConfig.count} onChange={e => setBulkConfig({ ...bulkConfig, count: e.target.value })} type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="5" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">N° Inicial</label>
                        <input value={bulkConfig.startNumber} onChange={e => setBulkConfig({ ...bulkConfig, startNumber: e.target.value })} type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="1" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sección / Área</label>
                      <select value={bulkConfig.section} onChange={e => setBulkConfig({ ...bulkConfig, section: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                        {sections.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Capacidad (x Mesa)</label>
                      <input value={bulkConfig.capacity} onChange={e => setBulkConfig({ ...bulkConfig, capacity: e.target.value })} type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="4" />
                    </div>
                  </>
                )}
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-indigo-500 transition-all active:scale-95 mt-4 text-white"
                >
                  {bulkMode ? 'Generar Mesas' : editingTable ? 'Actualizar Mesa' : 'Guardar Mesa'}
                </button>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}
    </div>
  );
};
