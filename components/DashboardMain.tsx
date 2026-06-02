import React, { useState, useEffect } from 'react';
import { NewExpenseModal } from './NewExpenseModal';
import { ArqueoModal } from './ArqueoModal';
import { ShiftMonitorModal } from './ShiftMonitorModal';
import { ClosingNotesModal } from './ClosingNotesModal';
import { SoldDishesModal } from './SoldDishesModal';
import { WaitersMonitor } from './WaitersMonitor';
import { CreditPaymentModal } from './CreditPaymentModal';
import { ShiftListModal } from './ShiftListModal';
import { WindowsConfirmModal } from './WindowsConfirmModal';
import { shiftService } from '../services/ShiftService';
import { activityLogService } from '../services/ActivityLogService';
import {
  Utensils, ShoppingCart, Truck, Home, Settings, ShieldCheck,
  Briefcase, Package, FileText, BarChart3,
  // New icons for buttons
  XCircle, CreditCard, ListChecks, Eye, Receipt, Map,
  Printer, CheckCircle, FilePieChart
} from 'lucide-react';
import { supabase } from '../supabase';
import { QIcon } from './QIcon';
import { PremiumIcon, ICON_MAP } from './shared/PremiumIcon';

import { User } from '../types';

interface DashboardProps {
  onNavigate: (view: any) => void;
  isAdmin?: boolean;
  settings?: any;
  currentUser?: User | null;
  onLogout?: () => void;
  onRefreshMenu?: (type: 'config' | 'images' | 'all') => Promise<void>;
  syncType?: 'config' | 'images' | 'all' | null;
  isSyncing?: boolean;
}

const MODULES = [
  { id: 'TABLES', label: 'MESAS', icon: Utensils, color: 'bg-white/5' },
  { id: 'QUICK', label: 'VENTA RÁPIDA', icon: ShoppingCart, color: 'bg-white/5' },
  { id: 'TAKEOUT', label: 'PARA LLEVAR', icon: Truck, color: 'bg-white/5' },
  { id: 'DELIVERY', label: 'A DOMICILIO', icon: Home, color: 'bg-white/5' },
];

// Mapped to groups in AdminPortal
const ADMIN_MODULES = [
  { id: 'ADMIN_SYS', label: 'SISTEMA', icon: Settings, iconify: ICON_MAP.ADMIN_SYS, color: 'bg-white/5', perms: ['Configuración General:Acceso', 'Usuarios:Acceso', 'Roles de Usuario:Acceso'] },
  { id: 'ADMIN_CONFIG', label: 'CONFIGURACIONES', icon: Briefcase, iconify: ICON_MAP.ADMIN_CONFIG, color: 'bg-white/5', perms: ['Cocinas:Acceso', 'Cajas:Acceso', 'Secciones:Acceso'] },
  { id: 'ADMIN_DISHES', label: 'PLATILLOS', icon: Utensils, iconify: ICON_MAP.ADMIN_DISHES, color: 'bg-white/5', perms: ['Platillos y Bebidas:Acceso'] },
  { id: 'ADMIN_INV', label: 'INVENTARIOS', icon: Package, iconify: ICON_MAP.ADMIN_INV, color: 'bg-white/5', perms: ['Productos:Acceso', 'Proveedores:Acceso'] },
  { id: 'ADMIN_REP', label: 'REPORTES', icon: FileText, iconify: ICON_MAP.ADMIN_REP, color: 'bg-white/5', perms: ['Reportes:Reporte General'] },
  { id: 'ADMIN_DASH', label: 'DASHBOARDS', icon: BarChart3, iconify: ICON_MAP.ADMIN_DASH, color: 'bg-white/5', perms: ['Reportes:Dashboards', 'Reportes:Ingresos a Caja'] },
];

import { useSecurityPolicy } from '../hooks/useSecurityPolicy';

export const DashboardMain: React.FC<DashboardProps> = ({ onNavigate, isAdmin, settings, currentUser, onLogout, onRefreshMenu, syncType, isSyncing }) => {
  const { canCloseCashRegister } = useSecurityPolicy(settings);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [showSoldDishesModal, setShowSoldDishesModal] = useState(false); // NEW
  const [showShiftMonitorModal, setShowShiftMonitorModal] = useState(false); // NEW
  const [showClosingNotesModal, setShowClosingNotesModal] = useState(false); // NEW
  const [showClosureSummary, setShowClosureSummary] = useState(false);
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);
  const [showShiftListModal, setShowShiftListModal] = useState(false);
  const [monitorRefreshKey, setMonitorRefreshKey] = useState(0);
  const [showCorteZConfirm, setShowCorteZConfirm] = useState(false);
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [waiterGoalEnabled, setWaiterGoalEnabled] = useState(false);
  const [monthUnits, setMonthUnits] = useState(0);
  const [monthlyUnitsGoal, setMonthlyUnitsGoal] = useState(0);
  const [waiterUnitsGoalEnabled, setWaiterUnitsGoalEnabled] = useState(false);

  const [serverOffset, setServerOffset] = useState<number>(() => {
    const cached = localStorage.getItem('kds_server_offset');
    return cached ? parseInt(cached, 10) : 0;
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowServer = new Date(Date.now() + serverOffset);
  const timeDisplay = nowServer.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateDisplay = nowServer.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

  const [closureData, setClosureData] = useState<any>(null);
  // We'll store temporary closure details here before final confirmation with notes
  const [pendingClosure, setPendingClosure] = useState<{ total: number, detail: any } | null>(null);
  const [lastArqueoCounted, setLastArqueoCounted] = useState<{ total: number, detail: any } | null>(null);

  const [cutType, setCutType] = useState<'X' | 'Z' | null>(null);
  const [expectedCash, setExpectedCash] = useState(0);

  // Filter modules based on settings
  const filteredModules = settings?.enable_quick_sale
    ? MODULES
    : MODULES.filter(m => m.id !== 'QUICK');

  const hasPermission = (perms: string[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.originalRole === 'ADMIN') return true;
    return perms.some(p => currentUser.permissions?.includes(p));
  };

  const isStrictAdmin = currentUser?.role === 'ADMIN';
  const showOperational = true;
  const showAdminPanel = isStrictAdmin || currentUser?.originalRole === 'ADMIN' || (currentUser?.permissions && currentUser.permissions.length > 0);
  const visibleAdminModules = ADMIN_MODULES.filter(mod => hasPermission(mod.perms));

  useEffect(() => {
    const fetchWaiterStats = async () => {
      if (!currentUser || currentUser.role !== 'MESERO') return;

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

      // Fetch all goal settings
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('monthly_waiter_goal, waiter_goal_enabled, monthly_waiter_units_goal, waiter_units_goal_enabled')
        .eq('id', 1)
        .single();

      const goal = Number(settingsData?.monthly_waiter_goal) || 0;
      const goalEnabled = settingsData?.waiter_goal_enabled ?? false;
      const unitsGoal = Number(settingsData?.monthly_waiter_units_goal) || 0;
      const unitsGoalEnabled = settingsData?.waiter_units_goal_enabled ?? false;

      setMonthlyGoal(goal);
      setWaiterGoalEnabled(goalEnabled);
      setMonthlyUnitsGoal(unitsGoal);
      setWaiterUnitsGoalEnabled(unitsGoalEnabled);

      // Fetch sales amount if enabled
      if (goalEnabled && goal > 0) {
        const { data, error } = await supabase
          .from('orders')
          .select('total, tip_amount')
          .eq('waiter_id', currentUser.id)
          .eq('status', 'completed')
          .gte('created_at', firstDay.toISOString());

        if (!error && data) {
          const total = data.reduce((acc, curr) => {
            const subtotal = (Number(curr.total) || 0) - (Number(curr.tip_amount) || 0);
            return acc + subtotal;
          }, 0);
          setMonthTotal(total);
        }
      }

      // Fetch unit count if enabled
      if (unitsGoalEnabled && unitsGoal > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('quantity, orders!inner(waiter_id, status, created_at)')
          .eq('orders.waiter_id', currentUser.id)
          .eq('orders.status', 'completed')
          .gte('orders.created_at', firstDay.toISOString());

        if (!itemsError && itemsData) {
          const units = itemsData.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
          setMonthUnits(units);
        }
      }
    };

    fetchWaiterStats();

    const channel = supabase.channel('waiter-stats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchWaiterStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Reusing existing useEffect logic for clarity, assume it's here
  useEffect(() => {
    const fetchDailySales = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      let query = supabase
        .from('orders')
        .select('total')
        .gte('created_at', today.toISOString())
        .eq('status', 'completed');

      if (cachedUser?.branch_id) query = query.eq('branch_id', cachedUser.branch_id);

      const { data, error } = await query;

      if (!error && data) {
        const total = data.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        setDailyTotal(total);
      }
    };

    fetchDailySales();
    const sub = supabase.channel('dashboard-sales')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        fetchDailySales();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleCloseShift = async (type: 'X' | 'Z', skipConfirm = false) => {
    if (!currentUser) return;

    // LOCAL definition to avoid any scope issues
    const isBaseAdmin = currentUser.role === 'ADMIN';
    const normalizedPerms = (currentUser.permissions || []).map(p => p.toLowerCase());

    // LAW OF THE ADMIN: If permission is configured, it MUST work.
    // CAJERO role always has access to their own shifts.
    // For other roles, check if they have the specific permission activated.
    if (type === 'X') {
      const hasCorteX = isBaseAdmin ||
        currentUser.role?.toUpperCase() === 'CAJERO' ||
        normalizedPerms.some(p => p.includes('corte x'));
      if (!hasCorteX) {
        alert('No tienes permisos para realizar Corte X (Parcial).');
        return;
      }
    } else {
      const hasCorteZ = isBaseAdmin ||
        currentUser.role?.toUpperCase() === 'CAJERO' ||
        normalizedPerms.some(p => p.includes('corte z'));
      if (!hasCorteZ) {
        alert('No tienes permisos para realizar Corte Z (Final).');
        return;
      }
    }

    // If it's a "Corte X", we open the Monitor directly without pre-fetching heavy report data yet
    if (type === 'X') {
      setCutType('X');
      setShowShiftMonitorModal(true);
      return;
    }

    // Pre-fetch expected amount to show in Arqueo (Only needed for Z now)
    let currentShift: any = null;
    try {
      const { shift, reportData } = await shiftService.getShiftData(currentUser);
      currentShift = shift;
      setExpectedCash(reportData?.expectedCash || 0);
    } catch (e) {
      console.error("Error fetching expected cash:", e);
      setExpectedCash(0);
    }

    // Corte Ciego (Refined logic)
    // Law of the user: No confirmation dialogues for closure.
    const isBlind = currentUser.role?.toUpperCase() === 'CAJERO' && normalizedPerms.some(p => p.includes('corte ciego'));

    // CHECK FOR OPEN ORDERS before Z closure
    if (type === 'Z') {
      const { allowed, reason } = await canCloseCashRegister();
      if (!allowed) {
        alert(`🚫 BLOQUEO DE CIERRE: ${reason}`);
        return;
      }

      // 1. Check local session state first to avoid race conditions or offline sync delays
      if (lastArqueoCounted) {
        setCutType('Z');
        setPendingClosure({ total: lastArqueoCounted.total, detail: lastArqueoCounted.detail });
        setShowClosingNotesModal(true);
        return;
      }

      // 2. Check if Arqueo is already done using the previously fetched shift
      if (currentShift && currentShift.counted_amount !== null && currentShift.counted_amount !== undefined) {
        // Arqueo already done, go straight to notes
        setCutType('Z');
        setPendingClosure({ total: currentShift.counted_amount, detail: currentShift.cash_detail });
        setShowClosingNotesModal(true);
        return;
      }
    }

    setCutType(type);
    setShowArqueoModal(true);
  };

  // Called after Arqueo is done (Counted money)
  const handleArqueoSave = (countedTotal: number, detail: any) => {
    setShowArqueoModal(false);
    
    // Store it locally for this session to prevent race conditions during 'Z' cut right after 'X'
    setLastArqueoCounted({ total: countedTotal, detail: detail });

    if (cutType === 'Z') {
      // If it's a Z cut and they just did the Arqueo, proceed to notes
      setPendingClosure({ total: countedTotal, detail: detail });
      setShowClosingNotesModal(true);
    } else {
      // If it's an X cut (Arqueo Rápido), process it directly without notes
      processShiftClosure(countedTotal, detail);
    }
  };

  // Called after Notes are confirmed (Legacy/Fallback)
  const handleClosingNotesConfirm = (notes: string) => {
    if (pendingClosure) {
      processShiftClosure(pendingClosure.total, pendingClosure.detail, notes);
      setShowClosingNotesModal(false);
      setPendingClosure(null);
    }
  };

  const processShiftClosure = async (countedTotal: number, cashDetail: any, notes?: string) => {
    if (!currentUser) return;

    // Prepare Base Closure Data
    const closingTime = new Date().toISOString();

    // 1. CHECK OFFLINE
    if (!navigator.onLine) {
      try {
        // We need a shift ID to close. If we can't get it from service, we might be in trouble
        // unless we use the one stored when opening (if opened offline).
        // For now, let's try to get what we can.
        const { shift } = await shiftService.getShiftData(currentUser);

        if (shift || cutType === 'Z') {
          const offlineData = {
            closingData: {
              end_time: closingTime,
              end_amount: 0, // Unknown offline
              counted_amount: countedTotal,
              difference_amount: 0, // Unknown offline
              cash_detail: cashDetail,
              closing_notes: notes || ''
            },
            cashRegisterId: shift?.cash_register_id
          };

          await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('CASH_CLOSE', offlineData));
          alert('✅ Cierre guardado localmente (Modo Offline). Se sincronizará al reconectar.');

          if (cutType === 'Z') {
            if (onLogout) onLogout();
          }
          return;
        }
      } catch (e) {
        console.error('Offline closure error:', e);
      }
    }


    try {
      // Use the service to get all data
      const { shift, reportData, error } = await shiftService.getShiftData(currentUser);

      if (error || !shift || !reportData) {
        alert(error || 'Error al obtener datos del turno.');
        return;
      }

      // Calculate final difference locally for update (service returns pre-calc expected)
      const difference = countedTotal - reportData.expectedCash;

      // Update report data with actual counts
      reportData.type = cutType as 'X' | 'Z';
      reportData.countedCash = countedTotal;
      reportData.difference = difference;
      reportData.denominations = cashDetail;
      if (notes) reportData.notes = notes;

      // Only Close if Z
      if (cutType === 'Z') {
        await shiftService.closeShift(shift.id, {
          end_time: reportData.endTime || closingTime,
          end_amount: reportData.expectedCash,
          counted_amount: countedTotal,
          difference_amount: difference,
          cash_detail: cashDetail,
          closing_notes: notes || ''
        }, shift.cash_register_id, currentUser);

        // LOG: Shift Closed (Corte Z)
        activityLogService.logFinancial({
          user: currentUser,
          module: 'CAJA',
          action: 'CORTE_Z',
          severity: 'CRITICAL',
          entity_id: shift.id,
          entity_type: 'SHIFT',
          details: {
            shiftId: shift.id,
            caja_id: shift.cash_register_id,
            efectivo_contado: countedTotal,
            efectivo_esperado: reportData.expectedCash,
            diferencia: difference,
            diferencia_absoluta: Math.abs(difference),
            cuadrado: difference === 0,
            denominaciones: cashDetail,
            notas_cierre: notes || '',
            hora_apertura: shift.start_time,
            hora_cierre: closingTime,
            monto_apertura: shift.start_amount,
            cajero: currentUser.name,
            ventas_efectivo: (reportData as any).cashSales || 0,
            ventas_tarjeta: (reportData as any).cardSales || 0,
            gastos_registrados: (reportData as any).expenses || 0
          }
        }, {
          amount: countedTotal,
          type: 'EGRESO',
          currency: 'GTQ',
          payment_breakdown: {
            efectivo: countedTotal
          }
        });
      } else {
        // For Corte X (Partial), we still persist the count to the DB so it shows in the Monitor
        await supabase
          .from('shifts')
          .update({
            counted_amount: countedTotal,
            difference_amount: difference,
            cash_detail: cashDetail
          })
          .eq('id', shift.id);

        // LOG: Shift Arqueo (Corte X)
        activityLogService.logFinancial({
          user: currentUser,
          module: 'CAJA',
          action: 'CORTE_X',
          severity: 'WARNING',
          entity_id: shift.id,
          entity_type: 'SHIFT',
          details: {
            shiftId: shift.id,
            caja_id: shift.cash_register_id,
            efectivo_contado: countedTotal,
            efectivo_esperado: reportData.expectedCash,
            diferencia: difference,
            diferencia_absoluta: Math.abs(difference),
            cuadrado: difference === 0,
            denominaciones: cashDetail,
            cajero: currentUser.name
          }
        }, {
          amount: countedTotal,
          type: 'NEUTRO',
          currency: 'GTQ'
        });

        // Force Monitor Refresh
        setMonitorRefreshKey(prev => prev + 1);

        // IMPORTANT: For Corte X, we don't show the Z summary modal. We just close.
        setShowShiftMonitorModal(true);
        return;
      }

      setClosureData(reportData);
      setShowClosureSummary(true);

    } catch (error) {
      console.error('Error closing shift:', error);
      alert('Error al cerrar turno.');
    } finally {
      setShowArqueoModal(false);
      // NOTE: Do NOT close ShiftMonitorModal here — Corte X returns to monitor after arqueo
    }
  };

  return (
    <div className={`h-full flex flex-col pt-8 pb-32 overflow-y-auto relative bg-[#2d2e3d]`}>
      {/* CORTE Z SYSTEM CONFIRM MODAL REMOVED BY USER REQUEST */}
      {showExpenseModal && currentUser && (

        <NewExpenseModal
          currentUser={currentUser}
          onClose={() => setShowExpenseModal(false)}
          onSaveSuccess={() => {
            setShowExpenseModal(false);
          }}
        />
      )}
      {showSoldDishesModal && (
        <SoldDishesModal onClose={() => setShowSoldDishesModal(false)} />
      )}
      {showShiftMonitorModal && currentUser && (
        <ShiftMonitorModal
          key={monitorRefreshKey}
          currentUser={currentUser}
          onClose={() => setShowShiftMonitorModal(false)}
          onArqueo={async () => {
            // Law of the user: Open drawer when arqueo starts
            const { printService } = await import('../services/PrintService');
            printService.openCashDrawer({
              userId: currentUser.id,
              userName: currentUser.name,
              reason: 'Arqueo de Caja'
            });

            // Open Arqueo modal, but conceptualize it as part of X
            try {
              const { reportData } = await shiftService.getShiftData(currentUser);
              setExpectedCash(reportData?.expectedCash || 0);
            } catch (e) { }
            setCutType('X');
            setShowArqueoModal(true);
          }}
          onCloseShift={() => {
            // Switch to Z flow
            handleCloseShift('Z');
          }}
        />
      )}
      {showArqueoModal && (
        <ArqueoModal
          onClose={() => setShowArqueoModal(false)}
          onSave={handleArqueoSave}
          expectedAmount={expectedCash}
          isBlind={currentUser?.role?.toUpperCase() === 'CAJERO' && (currentUser?.permissions || []).map(p => p.toLowerCase().trim()).some(p => p.includes('corte ciego'))}
          title={cutType === 'X' ? 'Arqueo Rápido (X)' : 'Arqueo para Cierre (Z)'}
        />
      )}
      {showClosingNotesModal && (
        <ClosingNotesModal
          onClose={() => setShowClosingNotesModal(false)}
          onConfirm={handleClosingNotesConfirm}
        />
      )}
      {showClosureSummary && closureData && (
        <ShiftClosureSummary
          data={closureData}
          onPrint={async () => {
            const { printService } = await import('../services/PrintService');

            // Law of the user: When clicking Print Z, instantly trigger the email sending in background
            if (currentUser) {
              shiftService.sendClosureEmail(currentUser, closureData).catch(e => {
                console.error('Error sending auto-email backup:', e);
              });
            }

            // 1. Print card terminal checkout first if cards details exist
            if (closureData.posCardDetail && closureData.posCardDetail.length > 0) {
              await printService.printPOSTarjetasReport(closureData);
            }

            // 2. Print main Z-Report
            await printService.printZReport(closureData);

            // 3. If there are expenses, print the summary ticket too
            if (closureData.expenses && closureData.expenses.length > 0) {
              await printService.printExpensesSummary(closureData);
            }
          }}
          onFinish={() => {
            setShowClosureSummary(false);
            if (onLogout) onLogout();
          }}
        />
      )}
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-12 px-8">
        {/* Main Operational Modules */}
        {showOperational && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto w-full">
              {filteredModules.map((mod: any) => (
                <button
                  key={mod.id}
                  onClick={() => onNavigate(mod.id)}
                  className={`group relative w-64 h-24 rounded-lg flex items-center justify-center gap-6 bg-[#3a3b4d] border border-white/5 shadow-md shadow-black/20 transition-all hover:bg-[#45465a] active:scale-95 animate-fade-in`}
                >
                  <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                    {mod.iconify ? (
                      <PremiumIcon icon={mod.iconify} size={48} />
                    ) : (
                      <mod.icon size={42} className="text-gray-400 group-hover:text-white" strokeWidth={1} />
                    )}
                  </div>
                  <span className="text-base font-black tracking-widest text-white uppercase">{mod.label}</span>
                </button>
              ))}
            </div>

            {/* Waiters Monitor - Included here for Cashiers */}
            {(currentUser?.role === 'CAJERO' || currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes('Cajas:Acceso')) && (
              <WaitersMonitor />
            )}
            {/* Goal Cards Area */}
            {currentUser?.role === 'MESERO' && (waiterGoalEnabled || waiterUnitsGoalEnabled) && (
              <div className="flex flex-wrap justify-center gap-4 w-full mt-12">

                {/* Sales Goal Card */}
                {waiterGoalEnabled && monthlyGoal > 0 && (
                  <div className="max-w-md flex-1 min-w-[280px] animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-[#3a3b4d] border border-white/5 rounded-lg p-4 shadow-md shadow-black/20 relative overflow-hidden group">
                      <div className="flex flex-col gap-4 relative z-10">
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Mi Meta de Ventas</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-white">{settings?.currency || 'Q'}{monthTotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">de {settings?.currency || 'Q'}{monthlyGoal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-indigo-400">{Math.min(100, Math.round((monthTotal / monthlyGoal) * 100))}%</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Progreso Mensual</span>
                          </div>
                        </div>
                        <div className="h-4 bg-black/40 rounded-full p-1 border border-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                            style={{ width: `${Math.min(100, (monthTotal / monthlyGoal) * 100)}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 h-1/2 rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {monthTotal >= monthlyGoal ? '\u00a1Meta Alcanzada! \uD83C\uDF89' : `Faltan ${settings?.currency || 'Q'}${(monthlyGoal - monthTotal).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-indigo-400 lowercase tracking-widest">actualizado en tiempo real</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Units Goal Card */}
                {waiterUnitsGoalEnabled && monthlyUnitsGoal > 0 && (
                  <div className="max-w-md flex-1 min-w-[280px] animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-[#3a3b4d] border border-white/5 rounded-lg p-4 shadow-md shadow-black/20 relative overflow-hidden group">
                      <div className="flex flex-col gap-4 relative z-10">
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Mi Meta de Unidades</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-white">{monthUnits.toLocaleString('es-GT')}</span>
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">de {monthlyUnitsGoal.toLocaleString('es-GT')}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-emerald-400">{Math.min(100, Math.round((monthUnits / monthlyUnitsGoal) * 100))}%</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Progreso Mensual</span>
                          </div>
                        </div>
                        <div className="h-4 bg-black/40 rounded-full p-1 border border-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            style={{ width: `${Math.min(100, (monthUnits / monthlyUnitsGoal) * 100)}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 h-1/2 rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {monthUnits >= monthlyUnitsGoal ? '\u00a1Meta Alcanzada! \uD83C\uDF89' : `Faltan ${(monthlyUnitsGoal - monthUnits).toLocaleString('es-GT')} unidades`}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-emerald-400 lowercase tracking-widest">actualizado en tiempo real</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}


          </div>
        )}
      </div>

      {/* FIXED WAITER SYNC ACTIONS (Always at bottom for Waiters) */}
      {currentUser?.role === 'MESERO' && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-[50] animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => onNavigate('HISTORY')}
              className="w-52 py-3 bg-blue-600/40 border border-blue-500/30 rounded-lg text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] transition-all shadow-md shadow-black/20 active:scale-95 hover:bg-blue-600/60 hover:text-white"
            >
              VISOR DE ORDENES
            </button>
            <button
              type="button"
              onClick={() => onRefreshMenu?.('config')}
              disabled={isSyncing}
              className={`w-52 py-3 bg-[#1a1b23] border border-white/10 rounded-lg text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] transition-all shadow-md shadow-black/20 active:scale-95 hover:text-white hover:bg-[#22232e] ${isSyncing ? 'opacity-50' : ''}`}
            >
              {syncType === 'config' ? 'ACTUALIZANDO...' : 'ACTUALIZAR CONFIGURACION'}
            </button>
            <button
              type="button"
              onClick={() => onRefreshMenu?.('images')}
              disabled={isSyncing}
              className={`w-52 py-3 bg-[#1a1b23] border border-white/10 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] transition-all shadow-md shadow-black/20 active:scale-95 hover:text-white hover:bg-[#22232e] ${isSyncing ? 'opacity-50' : ''}`}
            >
              {syncType === 'images' ? 'ACTUALIZANDO...' : 'ACTUALIZAR IMAGENES'}
            </button>
          </div>
        </div>
      )}

      {/* OPERATIONS FOOTER BAR - VISIBLE IF ANY RELEVANT PERMISSION EXISTS (LAW OF THE ADMIN) */}
      {currentUser?.role !== 'MESERO' && (currentUser?.role === 'ADMIN' ||
        currentUser?.role === 'CAJERO' ||
        currentUser?.role === 'SUPERVISOR' ||
        (currentUser?.permissions || []).some(p => {
          const lp = p.toLowerCase();
          return lp.includes('caja') || lp.includes('corte') || lp.includes('gasto') || lp.includes('abono') || lp.includes('financ');
        })) && (
          <div className={`fixed bottom-0 left-0 right-0 border-t border-white/5 px-6 py-4 z-30 shadow-md transition-colors bg-[#3a3b4d]`}>
            <div className="max-w-7xl mx-auto flex flex-col gap-3">

              {/* Row 1: Actions (Left) and Monitoring (Right) */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3">
                  <DashboardButton label="Gasto Nuevo" color="bg-yellow-400" onClick={() => setShowExpenseModal(true)} />
                  <DashboardButton label="Cierre de Turno" color="bg-green-500" onClick={() => handleCloseShift('X')} />
                </div>
                <div className="flex gap-3">
                  {(currentUser?.role === 'ADMIN' || currentUser?.originalRole === 'ADMIN') && (
                    <>
                      <DashboardButton label="Panel Admin" color="bg-red-500" onClick={() => onNavigate('ADMIN_PORTAL')} />
                    </>
                  )}
                  <DashboardButton label="Visor de Ordenes" color="bg-blue-500" onClick={() => onNavigate('HISTORY')} />
                </div>
              </div>

              {/* Row 2: Reports (Left) and Logistics (Right) */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3">
                  <DashboardButton label="Abono a Crédito" color="bg-yellow-400" onClick={() => setShowCreditPaymentModal(true)} />
                  <DashboardButton label="Platillos Vendidos General" color="bg-yellow-400" onClick={() => setShowSoldDishesModal(true)} />
                  <DashboardButton label="Listado de Cierres" color="bg-green-500" onClick={() => setShowShiftListModal(true)} />
                </div>
                <div className="flex gap-3">
                  <DashboardButton label="Visor Facturación" color="bg-blue-500" onClick={() => onNavigate('BILLING_VIEWER')} />
                  <DashboardButton label="Visor Domicilio" color="bg-blue-500" onClick={() => onNavigate('DELIVERY_LIST')} />
                </div>
              </div>
            </div>
          </div>
        )}
      {showCreditPaymentModal && (
        <CreditPaymentModal
          onClose={() => setShowCreditPaymentModal(false)}
          currentUserId={currentUser?.id || ''}
        />
      )}
      {showShiftListModal && (
        <ShiftListModal
          isOpen={showShiftListModal}
          onClose={() => setShowShiftListModal(false)}
        />
      )}

    </div>
  );
};

const DashboardButton = ({ label, color, onClick, disabled }: { label: string, color?: string, onClick?: () => void, disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`relative w-40 h-16 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all active:scale-95 group focus:outline-none flex items-center justify-center p-2 overflow-hidden shadow-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 group-hover:text-white text-center leading-[1.1]">{label}</span>
  </button>
);

const ShiftClosureSummary = ({ data, onPrint, onFinish }: { data: any, onPrint: () => void, onFinish: () => void }) => {
  const [isEmailing, setIsEmailing] = React.useState(false);

  return (
    <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#16191f] rounded-xl border border-white/10 shadow-xl shadow-black/50 overflow-hidden animate-slide-up">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <CheckCircle size={32} className="animate-bounce-slow" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">{data.type === 'X' ? 'Corte X Generado' : 'Turno Cerrado'}</h2>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">{data.type === 'X' ? 'El reporte parcial se ha generado' : 'El reporte de cierre ha sido generado'}</p>

          <div className="grid grid-cols-2 gap-3 mt-6 mb-8">
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Efectivo Contado</span>
              <span className="text-xl font-black tabular-nums tracking-tighter">Q{data.countedCash.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={`p-4 rounded-lg border ${data.difference === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest block mb-1 opacity-60">Diferencia</span>
              <span className="text-xl font-black tabular-nums tracking-tighter">{data.difference === 0 ? 'CUADRADO' : `Q${data.difference.toFixed(2)}`}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setIsEmailing(true);
                onPrint();
                setTimeout(() => setIsEmailing(false), 3000);
              }}
              disabled={isEmailing}
              className={`w-full py-4 bg-white/5 hover:bg-white/10 rounded-lg font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 border border-white/10 ${isEmailing ? 'opacity-50' : ''}`}
            >
              <Printer size={16} /> {isEmailing ? 'ENVIANDO CORREO Y GENERANDO...' : `IMPRIMIR ${data.type === 'X' ? 'CORTE X' : 'REPORTE Z'}`}
            </button>
            <button
              onClick={onFinish}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black uppercase tracking-widest text-[11px] shadow-md transition-all"
            >
              {data.type === 'X' ? 'CONTINUAR OPERACIÓN' : 'FINALIZAR Y SALIR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

