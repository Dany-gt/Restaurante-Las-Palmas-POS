import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Printer, LogOut, Calculator, ShoppingCart, Clock, DollarSign, Layout } from 'lucide-react';
import { ShiftReportData, shiftService } from '../services/ShiftService';
import { User } from '../types';

interface ShiftMonitorModalProps {
    currentUser: User;
    onClose: () => void;
    onArqueo: () => void; // Trigger standard marqueo modal
    onCloseShift: () => void; // Trigger standard close shift flow (Z)
}

export const ShiftMonitorModal: React.FC<ShiftMonitorModalProps> = ({ currentUser, onClose, onArqueo, onCloseShift }) => {
    const [data, setData] = useState<ShiftReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<string>('VENTAS');
    const [collapsedTerminals, setCollapsedTerminals] = useState<Set<string>>(new Set());

    const toggleTerminalCollapse = (terminalId: string) => {
        setCollapsedTerminals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(terminalId)) {
                newSet.delete(terminalId);
            } else {
                newSet.add(terminalId);
            }
            return newSet;
        });
    };

    const normalizedPerms = (currentUser?.permissions || []).map(p => p.toLowerCase().trim());
    const isBlind = currentUser?.role?.toUpperCase() === 'CAJERO' && normalizedPerms.some(p => p.includes('corte ciego'));

    const loadData = async () => {
        setLoading(true);
        const { reportData, error } = await shiftService.getShiftData(currentUser);
        if (error) {
            alert(error);
            onClose();
        } else {
            setData(reportData);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [currentUser.id]);

    const formatCurrency = (val: number) => `Q${(val || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Si todavía no hay data, renderizamos el esqueleto del modal para que abra INSTANTANEAMENTE
    if (!data) {
        return (
            <div className={`fixed inset-0 z-[100] flex items-center justify-center font-sans animate-fade-in ${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-[#323544]' : 'bg-[#0f1115]'}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-semibold text-white uppercase tracking-[0.3em] animate-pulse">Calculando Corte X...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col font-sans animate-fade-in overflow-hidden ${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-[#323544]' : 'bg-[#0f1115]'}`}>
            {/* Header */}
            <header className={`h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 ${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-[#2a2d3a]' : 'bg-[#16191f]'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                        <X size={24} className="text-gray-400" />
                    </button>
                    <div>
                        <span className="text-sm font-semibold tracking-widest uppercase text-white block">MONITOR DE TURNO</span>
                        <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-widest">
                            {currentUser.name} • Turno #{data.shiftNumber ?? data.shiftId.slice(0, 6)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={loadData} className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-500">
                        <Layout size={20} />
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">

                    {/* Top Cards: Sales Summary */}
                    <div className="grid grid-cols-4 gap-4">
                        {data.salesByMethod
                            .filter(item => !isBlind || item.method !== 'EFECTIVO')
                            .map((item) => (
                                <div key={item.method} className={`${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'} p-5 rounded-xl border border-white/5 flex flex-col`}>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">{item.method}</span>
                                    <span className="text-2xl font-semibold text-white">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className={`${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'} p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center`}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-1">Ordenes Atendidas</span>
                            <span className="text-3xl font-semibold text-white">{data.stats.ordersAttended}</span>
                        </div>
                        <div className={`${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'} p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center`}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-400 mb-1">Ordenes Anuladas</span>
                            <span className="text-3xl font-semibold text-white">{data.stats.cancelledOrders}</span>
                        </div>
                        <div className={`${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'} p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center`}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-1">Ordenes Abiertas</span>
                            <span className="text-3xl font-semibold text-white">{data.stats.openOrders}</span>
                        </div>
                        <div className={`${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'} p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center`}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">Comensales</span>
                            <span className="text-3xl font-semibold text-white">{data.stats.commensals}</span>
                        </div>
                    </div>

                    {/* Dynamic Content Area */}
                    <div className={`flex-1 rounded-xl border border-white/5 overflow-hidden flex flex-col ${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-white/5' : 'bg-[#1e212b]'}`}>
                        {activeView === 'VENTAS' && (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Detalle de Ventas</span>
                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded font-medium uppercase tracking-widest">{data.orders.length} Ordenes</span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest bg-[#16191f] sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left">Fecha/Hora</th>
                                                <th className="p-3 text-center">No. Orden</th>
                                                <th className="p-3 text-center">Mesa</th>
                                                <th className="p-3 text-right">Cuenta</th>
                                                {!isBlind && <th className="p-3 text-right text-emerald-400">Efectivo</th>}
                                                <th className="p-3 text-right text-sky-400">Tarjeta</th>
                                                <th className="p-3 text-right text-amber-400">Crédito</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300 divide-y divide-white/5">
                                            {data.orders.map((order) => {
                                                const isCash = order.paymentMethod === 'EFECTIVO';
                                                const isCard = order.paymentMethod === 'TARJETA';
                                                const isCredit = !isCash && !isCard; // Simplified logic, can be refined
                                                const dateObj = new Date(order.createdAt);

                                                // Format: 30/01/26
                                                const dateStr = dateObj.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                                // Format: 01:11 pm (12h) roughly. 
                                                const timeStr = dateObj.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

                                                return (
                                                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-gray-500 font-medium">{dateStr}</span>
                                                                <span className="font-medium text-white uppercase">{timeStr}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center font-mono text-gray-400">{order.orderNumber}</td>
                                                        <td className="p-3 text-center font-medium text-gray-200">
                                                            {order.tables ? `Mesa ${order.tables.number}` : order.table}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-medium">{formatCurrency(order.total)}</td>
                                                        {!isBlind && <td className="p-3 text-right font-mono text-emerald-400/80">{isCash ? formatCurrency(order.total) : '-'}</td>}
                                                        <td className="p-3 text-right font-mono text-sky-400/80">{isCard ? formatCurrency(order.total) : '-'}</td>
                                                        <td className="p-3 text-right font-mono text-amber-400/80">{isCredit ? formatCurrency(order.total) : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {data.orders.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                            <span className="text-xs uppercase tracking-widest">Sin registros de venta</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* Placeholders for other views */}

                        {activeView === 'PROPINAS' && (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Detalle de Propinas</span>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-medium uppercase tracking-widest">
                                        {data.orders.filter(o => o.tip > 0).length} Registros
                                    </span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest bg-[#16191f] sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left w-[15%]">No. Orden</th>
                                                <th className="p-3 text-center w-[10%]">Cuenta</th>
                                                <th className="p-3 text-left w-[30%]">Usuario</th>
                                                {!isBlind && <th className="p-3 text-right w-[15%] text-emerald-400">Efectivo</th>}
                                                <th className="p-3 text-right w-[15%] text-sky-400">Tarjeta</th>
                                                <th className="p-3 text-right w-[15%] text-gray-400">Otros</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300 divide-y divide-white/5">
                                            {data.orders.filter(o => o.tip > 0).map((order) => (
                                                <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 font-mono text-gray-400">
                                                        <div>{order.orderNumber}</div>
                                                        <div className="text-[9px] text-gray-600">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="p-3 text-center font-medium text-gray-200">
                                                        {order.tables ? `Mesa ${order.tables.number}` : order.table}
                                                    </td>
                                                    <td className="p-3 text-left font-medium text-gray-400 uppercase truncate">{order.waiter}</td>
                                                    {!isBlind && <td className="p-3 text-right font-mono text-emerald-400/80">{order.tipCash > 0 ? formatCurrency(order.tipCash) : '-'}</td>}
                                                    <td className="p-3 text-right font-mono text-sky-400/80">{order.tipCard > 0 ? formatCurrency(order.tipCard) : '-'}</td>
                                                    <td className="p-3 text-right font-mono text-gray-400/80">{order.tipOther > 0 ? formatCurrency(order.tipOther) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {data.orders.filter(o => o.tip > 0).length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                            <span className="text-xs uppercase tracking-widest">Sin propinas registradas</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeView === 'ABONOS' && (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Abonos a Créditos</span>
                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-medium uppercase tracking-widest">
                                        {formatCurrency(data.abonosByMethod.reduce((sum, a) => sum + a.amount, 0))}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest bg-[#16191f] sticky top-0">
                                            <tr>
                                                {!isBlind && <th className="p-3 text-center w-[20%]">Efectivo</th>}
                                                <th className="p-3 text-center w-[20%]">Tarjeta</th>
                                                <th className="p-3 text-center w-[20%]">Transferencia</th>
                                                <th className="p-3 text-center w-[20%]">Cheque</th>
                                                <th className="p-3 text-center w-[20%]">Otros</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300">
                                            <tr className="hover:bg-white/5 transition-colors">
                                                {!isBlind && (
                                                    <td className="p-3 text-center font-mono text-emerald-400/80">
                                                        {formatCurrency(data.abonosByMethod.find(a => a.method === 'EFECTIVO')?.amount || 0)}
                                                    </td>
                                                )}
                                                <td className="p-3 text-center font-mono text-sky-400/80">
                                                    {formatCurrency(data.abonosByMethod.find(a => a.method === 'TARJETA')?.amount || 0)}
                                                </td>
                                                <td className="p-3 text-center font-mono text-purple-400/80">
                                                    {formatCurrency(data.abonosByMethod.find(a => a.method === 'TRANSFERENCIA')?.amount || 0)}
                                                </td>
                                                <td className="p-3 text-center font-mono text-amber-400/80">
                                                    {formatCurrency(data.abonosByMethod.find(a => a.method === 'CHEQUE')?.amount || 0)}
                                                </td>
                                                <td className="p-3 text-center font-mono text-gray-400/80">
                                                    {formatCurrency(data.abonosByMethod.find(a => a.method === 'OTROS')?.amount || 0)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    {data.abonosByMethod.reduce((sum, a) => sum + a.amount, 0) === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                            <span className="text-xs uppercase tracking-widest">Sin abonos registrados</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeView === 'GASTOS' && !isBlind && (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Gastos del Turno</span>
                                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded font-medium uppercase tracking-widest">
                                        {data.expenses?.length || 0} Registro{(data.expenses?.length || 0) !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest bg-[#16191f] sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left">Fecha/Hora</th>
                                                <th className="p-3 text-left">Descripción</th>
                                                <th className="p-3 text-right text-rose-400">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300 divide-y divide-white/5">
                                            {data.expenses?.map((expense: any) => {
                                                const dateObj = new Date(expense.created_at);
                                                const dateStr = dateObj.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                                const timeStr = dateObj.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

                                                return (
                                                    <tr key={expense.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-gray-500 font-medium">{dateStr}</span>
                                                                <span className="font-medium text-white uppercase">{timeStr}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-medium text-gray-400">{expense.description || 'Gasto sin descripción'}</td>
                                                        <td className="p-3 text-right font-mono font-medium text-rose-400">{formatCurrency(expense.amount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {(!data.expenses || data.expenses.length === 0) && (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                            <span className="text-xs uppercase tracking-widest">Sin gastos registrados</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeView === 'POS' && (
                            <div className="flex flex-col h-full bg-[#2A2C38]">
                                <div className="p-4 border-b border-white/10 bg-[#353849] flex justify-center items-center">
                                    <span className="text-sm font-medium text-white">Cobros con Tarjeta</span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-[#353849] text-white font-medium sticky top-0 z-10 border-y border-white/10">
                                            <tr>
                                                <th className="p-3 text-center">Fecha</th>
                                                <th className="p-3 text-center">No. Orden</th>
                                                <th className="p-3 text-center">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300">
                                            {data.posCardDetail.map((terminal) => {
                                                const cardOrders = data.orders.filter(o => o.paymentMethod === 'TARJETA');
                                                // Group correctly using the posTerminalId we fixed
                                                const terminalOrders = cardOrders.filter(o => 
                                                    terminal.id === 'unassigned' ? !o.posTerminalId : String(o.posTerminalId) === String(terminal.id)
                                                );

                                                if (terminalOrders.length === 0) return null;

                                                return (
                                                    <React.Fragment key={terminal.id}>
                                                        {/* Group Header */}
                                                        <tr 
                                                            className="bg-[#e5e7eb] text-black font-medium text-xs uppercase cursor-pointer hover:bg-[#d1d5db] transition-colors select-none"
                                                            onClick={() => toggleTerminalCollapse(terminal.id)}
                                                        >
                                                            <td colSpan={3} className="px-3 py-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] transform transition-transform duration-200 inline-block" style={{ transform: collapsedTerminals.has(terminal.id) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>v</span>
                                                                    <span>{terminal.name}</span>
                                                                    <span className="ml-auto text-[10px] opacity-50 font-normal">{terminalOrders.length} trans.</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {/* Transactions */}
                                                        {!collapsedTerminals.has(terminal.id) && terminalOrders.map(order => {
                                                            const dateObj = new Date(order.createdAt);
                                                            const dateStr = dateObj.toLocaleDateString('es-GT', { day: 'numeric', month: '2-digit', year: 'numeric' });
                                                            const timeStr = dateObj.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                                                            return (
                                                                <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                    <td className="p-2 text-center">{`${dateStr} ${timeStr}`}</td>
                                                                    <td className="p-2 text-center">{order.orderNumber.replace('#', '')}</td>
                                                                    <td className="p-2 text-right pr-[10%]">{formatCurrency(order.total)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {/* Subtotal Footer */}
                                                        <tr className="bg-[#353849]">
                                                            <td colSpan={2}></td>
                                                            <td className="p-1 text-right">
                                                                <div className="bg-white text-black font-medium py-1 px-4 inline-block text-sm min-w-[120px] text-right">
                                                                    {formatCurrency(terminal.total)}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {data.orders.filter(o => o.paymentMethod === 'TARJETA').length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                            <span className="text-xs uppercase tracking-widest">Sin cobros con tarjeta</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeView !== 'VENTAS' && activeView !== 'PROPINAS' && activeView !== 'ABONOS' && activeView !== 'GASTOS' && activeView !== 'POS' && (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <span className="text-xs uppercase tracking-widest">Vista {activeView} en construcción</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="mt-auto pt-6 flex gap-4">
                        {[
                            { id: 'VENTAS', label: 'Ventas' },
                            { id: 'PROPINAS', label: 'Propinas' },
                            { id: 'ABONOS', label: 'Abonos CC' },
                            ...(!isBlind ? [{ id: 'GASTOS', label: 'Gastos' }] : []),
                            { id: 'POS', label: 'POS Tarjeta' },
                        ].map(btn => (
                            <button
                                key={btn.id}
                                className={`flex-1 h-14 border rounded-lg flex items-center justify-center text-xs font-semibold uppercase tracking-widest transition-all active:scale-95  /20 ${activeView === btn.id ? 'bg-indigo-600 border-indigo-500 text-white -500/20' : 'bg-[#1e212b] border-white/5 text-gray-400 hover:text-white hover:bg-[#2b2f3a]'}`}
                                onClick={() => setActiveView(btn.id)}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                </div>

                {/* Right Sidebar: Operational Summary & Cash Balance */}
                <div className={`w-[320px] border-l border-white/5 p-4 flex flex-col ${(currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') ? 'bg-[#2a2d3a]' : 'bg-[#1c1f26]'}`}>

                    <div className="space-y-2 flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">

                        {/* 1. Ordenes Asignadas */}
                        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all group">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:text-indigo-400 transition-colors">
                                    <ShoppingCart size={16} />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">Ordenes Asignadas</span>
                            </div>
                            <span className="text-lg font-semibold text-white tracking-tight">{data.stats.assignedOrders}</span>
                        </div>

                        {/* 2. Apertura */}
                        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all group">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:text-amber-400 transition-colors">
                                    <Clock size={16} />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">Apertura</span>
                            </div>
                            <span className="text-xs font-medium text-gray-400 text-right leading-tight tracking-tight">
                                {new Date(data.startTime).toLocaleString('es-GT', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                    hour12: false
                                })}
                            </span>
                        </div>

                        {/* 3. Ventas Totales */}
                        {!isBlind && (
                            <div className="mt-0.5 p-3 bg-[#2b2f3a] rounded-xl border border-white/5  relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-0.5 relative z-10">
                                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-widest">Ventas Totales</span>
                                </div>
                                <div className="flex items-center gap-2 relative z-10">
                                    <span className="text-2xl font-semibold text-indigo-400 tracking-tighter tabular-nums">
                                        {formatCurrency(data.salesTotal)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 4. Cuadre de Efectivo Section */}
                        {!isBlind && (
                            <div className="mt-2 pt-1">
                                <div className="flex items-center gap-2.5 mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-600">Cuadre de Efectivo</span>
                                    <div className="h-px flex-1 bg-white/5"></div>
                                </div>

                                <div className="space-y-2 px-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium uppercase tracking-widest text-[11px]">(+) Inicial</span>
                                        <span className="text-white font-mono font-medium tracking-tight text-sm">{formatCurrency(data.cashDetail.initial)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium uppercase tracking-widest text-[11px]">(+) Ventas (sin prop.)</span>
                                        <span className="text-white font-mono font-medium tracking-tight text-sm">{formatCurrency(data.cashDetail.sales)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium uppercase tracking-widest text-[11px]">(+) Abonos a CC</span>
                                        <span className="text-white font-mono font-medium tracking-tight text-sm">{formatCurrency(data.cashDetail.abonos)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium uppercase tracking-widest text-[11px]">(+) Propinas</span>
                                        <span className="text-white font-mono font-medium tracking-tight text-sm">{formatCurrency(data.cashDetail.tips)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-rose-400">
                                        <span className="font-medium uppercase tracking-widest text-[11px]">(-) Gastos</span>
                                        <span className="font-mono font-medium tracking-tight text-sm">{formatCurrency(data.cashDetail.expenses)}</span>
                                    </div>

                                    <div className="h-2 flex items-center">
                                        <div className="w-full h-px border-t border-dashed border-white/10 opacity-20"></div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-indigo-400 font-semibold uppercase tracking-widest">Efectivo Sistema</span>
                                        <span className="text-xl text-white font-semibold tabular-nums tracking-tighter">
                                            {formatCurrency(data.cashDetail.total)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                        <span className="font-medium uppercase tracking-widest text-[11px]">Efectivo Contado</span>
                                        <span className="font-mono font-medium tracking-tight text-sm">{formatCurrency(data.countedCash)}</span>
                                    </div>

                                    <div className="h-2 flex items-center">
                                        <div className="w-full h-px border-t border-dashed border-white/10 opacity-20"></div>
                                    </div>

                                    <div className={`flex justify-between items-center ${data.difference < 0 ? 'text-rose-500' : data.difference > 0 ? 'text-emerald-500' : 'text-gray-500'}`}>
                                        <span className="text-xs font-semibold uppercase tracking-widest">
                                            {data.difference < 0 ? 'Faltante' : data.difference > 0 ? 'Sobrante' : 'Diferencia'}
                                        </span>
                                        <span className="text-2xl font-semibold tabular-nums tracking-tighter">
                                            {formatCurrency(data.difference)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={onArqueo}
                            className="h-14 bg-indigo-600 hover:bg-indigo-500 text-white  -600/20 active:scale-95 rounded-lg font-semibold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                        >
                            <Calculator size={18} /> Arqueo de Caja
                        </button>
                        <button
                            onClick={onCloseShift}
                            className="h-14 bg-[#5c6bff] hover:bg-[#4b59eb] text-white rounded-lg font-semibold uppercase tracking-widest text-xs  -500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> Cerrar Turno
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
