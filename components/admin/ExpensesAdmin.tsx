import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, FileText, Trash2, Loader2, X, Tag, List, Eye, Printer, Ban, Clock, Check, User as UserIcon, Edit3 } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { printService } from '../../services/PrintService';
import { reportTemplates } from '../../services/ReportTemplates';
import { activityLogService } from '../../services/ActivityLogService';
import { User } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { ExpenseReportViewerModal } from './ExpenseReportViewerModal';

interface ExpensesAdminProps {
  currentUser?: User | null;
}

export const ExpensesAdmin: React.FC<ExpensesAdminProps> = ({ currentUser }) => {

  // Expenses State
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: '', branch_id: '' });
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });

  // Categories State
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number, y: number, category: any | null } | null>(null);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const getLocalDateStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(getLocalDateStr());
  const [endDate, setEndDate] = useState(getLocalDateStr());
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [branches, setBranches] = useState<any[]>([]);

  // Audit State
  const [selectedExpenseForAudit, setSelectedExpenseForAudit] = useState<any | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, expense: any } | null>(null);

  const fetchData = async (overrideSearch?: string) => {
    setLoading(true);

    // Fetch Branches for filter
    const { data: brData } = await supabase.from('branches').select('id, name').order('name');
    if (brData) setBranches(brData);

    let query = supabase
      .from('expenses')
      .select(`
        *,
        branches(name),
        profiles:cashier_id(name),
        cash_registers:cash_register_id(name),
        shifts:shift_id(shift_number)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (selectedBranch !== 'ALL') {
      query = query.eq('branch_id', selectedBranch);
    }

    const currentSearchTerm = overrideSearch !== undefined ? overrideSearch : searchTerm;

    if (currentSearchTerm.trim()) {
      // Direct filtering by ilike for better performance
      query = query.or(`description.ilike.%${currentSearchTerm}%,category.ilike.%${currentSearchTerm}%`);
    }

    const { data: expData, error: expError } = await query.order('created_at', { ascending: false });

    if (expError) {
      console.error('Error fetching expenses:', expError);
    } else if (expData) {
      // Advanced local search filtering
      const filtered = expData.filter(e => {
        const term = currentSearchTerm.toLowerCase();
        const inMain = (e.description?.toLowerCase().includes(term) || e.category?.toLowerCase().includes(term));
        const inItems = e.items?.some((item: any) => item.name?.toLowerCase().includes(term));
        return inMain || inItems;
      });
      setExpenses(filtered);
      calculateStats(filtered);
    }

    // Fetch Categories
    fetchCategories();
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data: catData } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (catData) setCategories(catData);
  };

  const calculateStats = (data: any[]) => {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let today = 0, week = 0, month = 0;

    data.forEach(exp => {
      const time = new Date(exp.created_at).getTime();
      const amt = Number(exp.amount) || 0;
      if (time >= startOfDay) today += amt;
      if (time >= startOfWeek) week += amt;
      if (time >= startOfMonth) month += amt;
    });

    setStats({ today, week, month });
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedBranch]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDeleteExpense = async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      if (currentUser) {
        activityLogService.log({
          user: currentUser,
          module: 'ADMIN',
          action: 'Eliminación de Gasto',
          details: {
            expenseId: id,
            description: expenseToDelete?.description,
            amount: expenseToDelete?.amount
          }
        });
      }
      fetchData();
    }
  };

  const handleReprint = async (expense: any) => {
    try {
      await printService.printDetailedExpense(expense);
    } catch (error) {
      console.error('Error reprinting:', error);
      alert('Error al reimprimir el ticket.');
    }
  };

  const handleVoidExpense = async (id: string) => {
    if (!confirm('¿Desea anular este gasto? El monto se mantendrá en el registro pero marcado como anulado.')) return;
    const { error } = await supabase
      .from('expenses')
      .update({ is_void: true, voided_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      if (currentUser) {
        const voidedExpense = expenses.find(e => e.id === id);
        activityLogService.log({
          user: currentUser,
          module: 'ADMIN',
          action: 'Anulación de Gasto',
          details: {
            expenseId: id,
            description: voidedExpense?.description,
            amount: voidedExpense?.amount
          }
        });
      }
      fetchData();
    }
  };

  const handlePrintReport = () => {
    if (expenses.length === 0) {
      alert('No hay gastos en este rango de fechas para imprimir.');
      return;
    }
    const html = reportTemplates.generateA4ExpenseReport(expenses, startDate, endDate);
    setReportHtml(html);
    setShowReportViewer(true);
  };

  const handleContextMenu = (e: React.MouseEvent, expense: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, expense });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
      setCategoryContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleSaveExpense = async () => {
    if (!newExpense.description || !newExpense.amount || !newExpense.category) return alert('Complete todos los campos');

    // Prepare Base Object
    const expenseId = generateUUID();
    const expenseData = {
      id: expenseId,
      description: newExpense.description.toUpperCase(),
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      cashier_id: currentUser?.id,
      branch_id: newExpense.branch_id || (selectedBranch !== 'ALL' ? selectedBranch : null),
      created_at: new Date().toISOString()
    };

    // 1. CHECK OFFLINE
    if (!navigator.onLine) {
      try {
        await import('../../services/OfflineDB').then(m => m.offlineDB.saveRecord('EXPENSE', expenseData));
        console.log('📦 Gasto guardado offline (IndexedDB):', expenseId);

        alert('✅ Registro guardado localmente (Modo Offline).');

        setShowModal(false);
        setNewExpense({ description: '', amount: '', category: '', branch_id: '' });
        window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
        return;
      } catch (e) {
        console.error('Error saving expense offline:', e);
      }
    }

    setLoading(true);
    try {
      // Get current shift if any (context for database)
      let activeShiftId = null;
      let activeRegisterId = null;
      let activeBranchId = null;

      if (currentUser) {
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('id, cash_register_id, cash_registers(branch_id)')
          .eq('cashier_id', currentUser.id)
          .eq('status', 'OPEN')
          .maybeSingle();

        if (shiftData) {
          activeShiftId = shiftData.id;
          activeRegisterId = shiftData.cash_register_id;
          activeBranchId = (shiftData.cash_registers as any)?.branch_id;
        }
      }

      const { error } = await supabase.from('expenses').insert([{
        ...expenseData,
        shift_id: activeShiftId,
        register_id: activeRegisterId,
        branch_id: activeBranchId || expenseData.branch_id
      }]);

      if (error) throw error;

      // Logging: Expense Registration
      if (currentUser) {
        activityLogService.log({
          user: currentUser,
          module: 'ADMIN',
          action: 'Registro de Gasto',
          details: {
            expenseId: expenseId,
            description: expenseData.description,
            amount: expenseData.amount,
            category: expenseData.category
          }
        });
      }

      setShowModal(false);
      setNewExpense({ description: '', amount: '', category: '', branch_id: '' });
      fetchData();
    } catch (e: any) {
      console.error('Error saving expense:', e);
      // Fallback to offline if save fails
      await import('../../services/OfflineDB').then(m => m.offlineDB.saveRecord('EXPENSE', expenseData));
      alert('⚠️ Error de conexión: El gasto se guardó localmente para sincronización posterior.');
      setShowModal(false);
      setNewExpense({ description: '', amount: '', category: '', branch_id: '' });
      window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
    } finally {
      setLoading(false);
    }
  };

  // Category Actions
  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return alert('Ingrese un nombre');
    const name = categoryName.trim().toUpperCase();

    setSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ name })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expense_categories')
          .insert([{ name, is_active: true }]);
        if (error) throw error;
      }
      
      // Logging: Category Management
      if (currentUser) {
        activityLogService.log({
          user: currentUser as any,
          module: 'ADMIN',
          action: editingCategory ? 'Actualización de Categoría de Gasto' : 'Creación de Categoría de Gasto',
          details: {
            categoryId: editingCategory?.id,
            name: name
          }
        });
      }

      setShowCategoryModal(false);
      setCategoryName('');
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar categoría?')) return;
    const { error } = await supabase.from('expense_categories').delete().eq('id', id); // Or start update is_active=false

    if (error) {
      alert('Error: ' + error.message);
    } else {
      fetchCategories();
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-[#f0f0f0] font-sans overflow-hidden text-[11px] select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#f0f0f0] border-b border-gray-300 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white border border-gray-400 rounded-sm flex items-center justify-center text-slate-700">
            <Tag size={14} />
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-tight text-slate-900 leading-none">Gastos y Categorías</h2>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Control de Egresos de Caja</p>
          </div>
        </div>

      </div>

      <div className="flex-1 overflow-hidden flex p-2 gap-2">
        {/* Sidebar Categorías */}
        <div
          className="w-64 shrink-0 flex flex-col bg-white border border-gray-300 shadow-sm"
          onContextMenu={(e) => {
            e.preventDefault();
            setCategoryContextMenu({ x: e.clientX, y: e.clientY, category: null });
          }}
        >
          <div className="bg-[#e8ecef] px-3 py-1.5 border-b border-gray-300">
            <span className="text-[10px] font-bold uppercase text-[#106ebe]">Categorías</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pt-1 font-medium bg-[#fcfdfe]">
            <div className="px-1 space-y-[1px]">
              <button
                onClick={() => { setSearchTerm(''); fetchData(''); }}
                className={`w-full flex items-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-left transition-colors ${!searchTerm ? 'bg-[#106ebe] text-white shadow-sm' : 'text-slate-600 hover:bg-[#cce8ff]'}`}
                title="Ver todos los gastos"
              >
                TODOS LOS GASTOS
              </button>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => { setSearchTerm(cat.name); fetchData(cat.name); }}
                  onDoubleClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setShowCategoryModal(true); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCategoryContextMenu({ x: e.clientX, y: e.clientY, category: cat });
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 transition-all cursor-default group border-b border-transparent ${searchTerm === cat.name ? 'bg-[#106ebe] text-white shadow-sm' : 'hover:bg-[#cce8ff] text-slate-600'}`}
                  title={`${cat.name} (Doble clic para editar, Clic derecho para opciones)`}
                >
                  <span className="text-[10px] uppercase truncate flex-1">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {/* Header Panel */}
          <div className="bg-[#cbd5e1] border border-gray-300 px-3 py-1 shrink-0">
            <span className="text-[10px] font-bold text-[#106ebe] uppercase tracking-tight">Gastos de Caja</span>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 border border-gray-300 shadow-sm flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-700">Sucursal</span>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="bg-white border border-gray-400 rounded-sm px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] transition-all min-w-[280px]"
              >
                <option value="ALL">TODAS</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-700">Del</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-white border border-gray-400 rounded-sm px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe]"
              />
              <span className="text-[10px] font-bold text-slate-700">Al</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-white border border-gray-400 rounded-sm px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="bg-[#106ebe] hover:bg-[#005a9e] text-white px-6 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                title="Generar consulta"
              >
                Generar
              </button>
              <button
                onClick={handlePrintReport}
                className="bg-[#106ebe] hover:bg-[#002244] text-white px-6 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                title="Imprimir reporte"
              >
                Imprimir
              </button>
            </div>

            <div className="flex-1 flex items-center justify-end gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Introduzca el texto a buscar..."
                  className="bg-white border border-gray-400 rounded-sm px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase w-64"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchData()}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div
            onContextMenu={(e) => {
              if ((e.target as HTMLElement).closest('thead')) return;
              handleContextMenu(e, null);
            }}
            className="flex-1 bg-white border border-gray-300 shadow-sm overflow-hidden flex flex-col relative"
          >
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-[#106ebe]" size={32} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#e8e8e8] select-none border-b border-gray-400">
                    <tr className="h-8">
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Fecha</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-16">Hora</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Caja</th>
                      <th className="px-4 py-2 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-24">Turno No.</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-24">Número</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Categoría</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Descripción</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-black uppercase border-r border-gray-300">Monto</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Usuario</th>
                      <th className="px-4 py-2 text-center text-[10px] font-bold text-black uppercase border-gray-300 w-16">Anulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        onDoubleClick={() => setSelectedExpenseForAudit(exp)}
                        onContextMenu={(e) => handleContextMenu(e, exp)}
                        className={`h-6 transition-colors border-b border-gray-100 cursor-default ${exp.is_void ? 'opacity-50 grayscale bg-red-50/20' : 'text-slate-900 even:bg-slate-50/50 hover:bg-[#cce8ff]'}`}
                      >
                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold tabular-nums text-left">
                          {new Date(exp.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold tabular-nums text-slate-500 text-left">
                          {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold uppercase truncate text-left">
                          {exp.cash_registers?.name || '--'}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-center text-[10px] font-bold tabular-nums">
                          {exp.shifts?.shift_number || '--'}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[9px] font-bold text-indigo-600 uppercase text-left">
                          #{exp.expense_number || exp.id.toString().substring(0, 6)}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[9px] font-bold uppercase text-left">
                          <span className="bg-slate-100 px-1 border border-gray-200 text-slate-600 rounded-sm">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold uppercase truncate max-w-xs text-left">
                          {exp.description}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-right text-[11px] font-black tabular-nums text-rose-600">
                          Q{Number(exp.amount).toFixed(2)}
                        </td>
                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold uppercase truncate text-left">
                          {exp.profiles?.name || '--'}
                        </td>
                        <td className="px-4 text-center">
                          <div className="flex justify-center items-center h-full">
                            <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${exp.is_void ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-300'}`}>
                              {exp.is_void && <Check size={10} strokeWidth={4} />}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right-Click Context Menu Area */}
      {contextMenu && contextMenu.expense && createPortal(
        <div
          className="fixed z-[1000] bg-white border border-gray-400 shadow-[2px_2px_5px_rgba(0,0,0,0.2)] py-1 w-48 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1 border-b border-gray-200 mb-1 bg-[#f0f0f0]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Opciones de Gasto</span>
          </div>
          <button
            onClick={() => { setSelectedExpenseForAudit(contextMenu.expense); closeContextMenu(); }}
            className="w-full text-left px-3 py-1 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
            title="Ver detalles completos del gasto"
          >
            <Eye size={12} /> Ver Detalles
          </button>
          <button
            onClick={() => { handleReprint(contextMenu.expense); closeContextMenu(); }}
            className="w-full text-left px-3 py-1 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
            title="Reimprimir el ticket de este gasto"
          >
            <Printer size={12} /> Reimprimir Ticket
          </button>
          {!contextMenu.expense.is_void && (
            <button
              onClick={() => { handleVoidExpense(contextMenu.expense.id); closeContextMenu(); }}
              className="w-full text-left px-3 py-1 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
              title="Marcar registro como anulado"
            >
              <Ban size={12} /> Anular Registro
            </button>
          )}
          <button
            onClick={() => { handleDeleteExpense(contextMenu.expense.id); closeContextMenu(); }}
            className="w-full text-left px-3 py-1 text-[10px] font-bold text-rose-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
            title="Eliminar registro permanentemente"
          >
            <Trash2 size={12} /> Eliminar
          </button>
          <div className="mt-1 pt-1 border-t border-gray-200">
            <button
              onClick={() => { setShowModal(true); closeContextMenu(); }}
              className="w-full text-left px-3 py-1 text-[10px] font-bold text-[#106ebe] hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
              title="Registrar un nuevo gasto"
            >
              <Plus size={12} /> Nuevo Gasto
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Global Add Item Context Menu (when clicking empty area) */}
      {contextMenu && !contextMenu.expense && createPortal(
        <div
          className="fixed z-[1000] bg-white border border-gray-400 shadow-[2px_2px_5px_rgba(0,0,0,0.2)] py-1 w-48 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1 border-b border-gray-200 mb-1 bg-[#f0f0f0]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Operaciones</span>
          </div>
          <button
            onClick={() => { setShowModal(true); closeContextMenu(); }}
            className="w-full text-left px-3 py-1 text-[10px] font-bold text-[#106ebe] hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
            title="Registrar un nuevo gasto"
          >
            <Plus size={12} /> Nuevo Gasto
          </button>
          <button
            onClick={() => { fetchData(); closeContextMenu(); }}
            className="w-full text-left px-3 py-1 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase"
          >
            <Clock size={12} /> Actualizar Vista
          </button>
        </div>,
        document.body
      )}

      {/* Maintenance Modals */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 md:p-6 pointer-events-none">
          <DraggableWindow id="expense-maintenance" title="Mantenimiento de Gastos">
            <div className="w-full h-full md:h-auto md:max-w-xl bg-white border border-gray-300 shadow-2xl relative flex flex-col animate-zoom-in overflow-hidden pointer-events-auto">
              <div className="px-3 h-8 bg-[#106ebe] flex justify-between items-center modal-header cursor-default select-none">
                <span className="text-white text-[11px] font-bold uppercase tracking-wider">Mantenimiento de Gastos</span>
                <div className="flex items-center gap-1">
                  <button onClick={handleSaveExpense} title="Guardar Gasto" className="w-6 h-6 flex items-center justify-center hover:bg-white/20 text-white transition-all">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                  </button>
                  <button onClick={() => setShowModal(false)} title="Cerrar" className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-100/80 px-4 py-1 border-b border-gray-200">
                <span className="text-[#106ebe] text-[10px] font-black uppercase tracking-wider">Datos de Gasto</span>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto bg-white">
                <div className="flex items-center gap-4">
                  <label className="text-[10px] font-bold text-gray-500 w-20 shrink-0">Fecha</label>
                  <div className="flex-1 bg-white border border-gray-100 h-7 flex items-center px-2 text-[11px] font-bold text-slate-800">
                    {new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-[10px] font-bold text-gray-500 w-20 shrink-0">Sucursal</label>
                  <select
                    value={newExpense.branch_id}
                    onChange={e => setNewExpense({ ...newExpense, branch_id: e.target.value })}
                    className="flex-1 border border-dotted border-gray-400 h-7 px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase transition-all bg-white min-w-[280px]"
                  >
                    <option value="">[Elija una Sucursal]</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-[10px] font-bold text-gray-500 w-20 shrink-0">Monto</label>
                  <div className="flex-1 flex items-center gap-1">
                    <span className="text-[11px] font-black text-slate-800">Q</span>
                    <input
                      value={newExpense.amount}
                      onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                      type="number"
                      step="0.01"
                      className="flex-1 h-7 px-1 text-[11px] font-black text-slate-900 outline-none border-b border-gray-200 w-full text-right tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <label className="text-[10px] font-bold text-gray-500 w-20 shrink-0 mt-2">Descripción</label>
                  <textarea
                    value={newExpense.description}
                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="flex-1 border border-gray-300 p-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase transition-all min-h-[120px] resize-none custom-scrollbar"
                    placeholder="INTRODUZCA LA DESCRIPCIÓN DEL GASTO..."
                  />
                </div>
              </div>

              <div className="p-6 bg-white border-t border-gray-100">
                <button
                  onClick={handleSaveExpense}
                  disabled={loading}
                  className="w-full py-2.5 bg-[#106ebe] hover:bg-[#002244] text-white rounded-sm font-bold uppercase tracking-widest text-[11px] transition-all active:scale-[0.98] disabled:opacity-50 shadow-md"
                >
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmar Registro'}
                </button>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}

      {/* Financial Audit Modal */}
      {selectedExpenseForAudit && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 md:p-6 pointer-events-none">
          <DraggableWindow id="expense-audit" title="Detalle de Gasto (Auditoría)">
            <div className="w-full h-full md:h-auto md:max-w-xl bg-white border border-gray-300 shadow-2xl relative flex flex-col animate-zoom-in overflow-hidden pointer-events-auto">
              <div className="px-6 py-4 bg-[#f0f0f0] flex justify-between items-center border-b border-gray-300 modal-header cursor-default select-none">
                <div>
                  <h3 className="text-sm font-bold uppercase text-slate-800 tracking-tight">Detalle de Gasto</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestión del Registro</p>
                </div>
                <button onClick={() => setSelectedExpenseForAudit(null)} className="w-8 h-8 hover:bg-gray-200 text-slate-400 rounded-sm flex items-center justify-center transition-all" title="Cerrar">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Descripción General</label>
                  <div className="bg-white border border-gray-200 p-4 rounded-sm">
                    <span className="text-xs font-bold text-slate-800 uppercase block leading-tight">
                      {selectedExpenseForAudit.description}
                    </span>
                  </div>
                </div>

                {selectedExpenseForAudit.items?.length > 0 && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Desglose Técnico</label>
                    <div className="space-y-1">
                      {selectedExpenseForAudit.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 border border-gray-100 rounded-sm">
                          <span className="text-[10px] font-bold text-slate-700 uppercase">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-500">Q{Number(item.price || item.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block text-center">Total Líquido</label>
                  <div className="text-center">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">
                      Q{Number(selectedExpenseForAudit.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#f8f9fa] border-t border-gray-300 grid grid-cols-2 gap-3">
                <button
                  onClick={() => { handleReprint(selectedExpenseForAudit); setSelectedExpenseForAudit(null); }}
                  className="flex items-center justify-center gap-2 bg-[#106ebe] hover:bg-[#005a9e] text-white py-2 px-4 rounded-sm font-bold text-[10px] tracking-widest uppercase transition-all shadow-sm active:scale-95"
                  title="Imprimir ticket"
                >
                  <Printer size={14} /> IMPRIMIR
                </button>
                <button
                  onClick={() => setSelectedExpenseForAudit(null)}
                  className="bg-white border border-gray-300 text-slate-500 py-2 px-4 rounded-sm font-bold text-[10px] tracking-widest uppercase transition-all active:scale-95 shadow-sm"
                  title="Cerrar modal"
                >
                  CERRAR
                </button>
              </div>

              <div className="px-6 pb-4 flex justify-center gap-4">
                {!selectedExpenseForAudit.is_void && (
                  <button
                    onClick={() => { handleVoidExpense(selectedExpenseForAudit.id); setSelectedExpenseForAudit(null); }}
                    className="text-[9px] font-bold text-amber-600 hover:underline uppercase tracking-widest transition-all"
                    title="Anular este gasto"
                  >
                    Anular Registro
                  </button>
                )}
                <button
                  onClick={() => { handleDeleteExpense(selectedExpenseForAudit.id); setSelectedExpenseForAudit(null); }}
                  className="text-[9px] font-bold text-rose-600 hover:underline uppercase tracking-widest transition-all"
                  title="Eliminar permanentemente"
                >
                  Eliminar Permanente
                </button>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}

      {/* Expense Report Viewer Modal */}
      <ExpenseReportViewerModal
        isOpen={showReportViewer}
        onClose={() => setShowReportViewer(false)}
        reportHtml={reportHtml}
      />

      {/* Category Context Menu */}
      {categoryContextMenu && createPortal(
        <div
          className="fixed z-[1000] bg-white border border-gray-300 shadow-[4px_4px_10px_rgba(0,0,0,0.2)] py-1 min-w-[140px] animate-zoom-in"
          style={{ top: categoryContextMenu.y, left: categoryContextMenu.x }}
        >
          <button
            onClick={() => { setEditingCategory(null); setCategoryName(''); setShowCategoryModal(true); setCategoryContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase transition-colors"
          >
            <Plus size={12} /> Nuevo
          </button>
          {categoryContextMenu.category && (
            <>
              <button
                onClick={() => { setEditingCategory(categoryContextMenu.category); setCategoryName(categoryContextMenu.category.name); setShowCategoryModal(true); setCategoryContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase transition-colors"
              >
                <Edit3 size={12} className="text-[#106ebe]" /> Editar
              </button>
              <button
                onClick={() => { handleDeleteCategory(categoryContextMenu.category.id); setCategoryContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-2 uppercase transition-colors"
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </>
          )}
          <div className="h-px bg-gray-200 my-1"></div>
          <button
            onClick={() => { fetchCategories(); setCategoryContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 uppercase transition-colors"
          >
            <Clock size={12} /> Refrescar
          </button>
        </div>,
        document.body
      )}

      {/* Category Maintenance Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 pointer-events-none">
          <DraggableWindow id="expense-categories" title="Categoría de Gastos">
            <div className="w-full h-full md:max-w-xl bg-white border border-gray-300 shadow-2xl relative flex flex-col animate-zoom-in overflow-hidden pointer-events-auto">
              <div className="px-3 h-8 bg-[#106ebe] flex justify-between items-center modal-header cursor-default select-none">
                <span className="text-white text-[11px] font-bold uppercase tracking-wider">Mantenimiento de Categorías</span>
                <div className="flex items-center gap-1">
                  <button onClick={handleSaveCategory} title="Guardar Categoría" className="w-6 h-6 flex items-center justify-center hover:bg-white/20 text-white transition-all">
                    {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                  </button>
                  <button onClick={() => setShowCategoryModal(false)} title="Cerrar" className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-100/80 px-4 py-1 border-b border-gray-200">
                <span className="text-[#106ebe] text-[10px] font-black uppercase tracking-wider">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</span>
              </div>

              <div className="p-4 bg-white">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Nombre de Categoría</label>
                    <input
                      autoFocus
                      value={categoryName}
                      onChange={e => setCategoryName(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
                      type="text"
                      className="w-full border border-gray-300 h-8 px-3 text-[11px] font-black text-slate-700 outline-none focus:border-[#106ebe] uppercase transition-all bg-white"
                      placeholder="ESCRIBA EL NOMBRE..."
                    />
                  </div>

                  <button
                    onClick={handleSaveCategory}
                    disabled={savingCategory}
                    className="w-full py-2.5 bg-[#106ebe] hover:bg-[#002244] text-white rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all active:scale-[0.98] disabled:opacity-50 shadow-md"
                  >
                    {savingCategory ? <Loader2 size={16} className="animate-spin mx-auto" /> : (editingCategory ? 'Actualizar Registro' : 'Confirmar Registro')}
                  </button>
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes zoom-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-zoom-in { animation: zoom-in 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
