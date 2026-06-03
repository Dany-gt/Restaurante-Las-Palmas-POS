import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { printService } from '../../services/PrintService';
import { DraggableWindow } from './DraggableWindow';

export const ReportGeneral: React.FC = () => {
    const getLocalISOString = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportGeneral_State_${userId}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [startDate, setStartDate] = useState(savedState?.startDate || getLocalISOString());
    const [endDate, setEndDate] = useState(savedState?.endDate || getLocalISOString());

    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(savedState?.selectedBranch || 'ALL');

    // Report data structure
    const [reportData, setReportData] = useState({
        ventas: { efectivo: 0, tarjeta: 0, credito: 0, otros: 0, total: 0 },
        propinas: { efectivo: 0, tarjeta: 0, otros: 0, total: 0 },
        egresos: { compras: 0, gastos: 0, descuentos: 0, total: 0 },
        ordenes: { atendidas: 0, anuladas: 0, comensales: 0 },
        ticket: { porPersona: 0, porOrden: 0 }
    });

    useEffect(() => {
        const fetchBranches = async () => {
            const { data } = await supabase.from('branches').select('id, name').order('name');
            if (data) setBranches(data);
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        const state = { selectedBranch, startDate, endDate };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [selectedBranch, startDate, endDate, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const startStr = `${startDate}T00:00:00`;
            const endStr = `${endDate}T23:59:59`;

            // Orders (joined with order_items to sum real discounts)
            let oQuery = supabase.from('orders').select('status, total, payment_method, tip_amount, pax_count, discount_amount, order_items(discount_amount)')
                .gte('created_at', startStr).lte('created_at', endStr).in('status', ['completed', 'cancelled']);
            if (selectedBranch !== 'ALL') oQuery = oQuery.eq('branch_id', selectedBranch);
            const { data: orders } = await oQuery;

            // Expenses
            let eQuery = supabase.from('expenses').select('amount')
                .gte('created_at', startStr).lte('created_at', endStr).neq('is_void', true);
            if (selectedBranch !== 'ALL') eQuery = eQuery.eq('branch_id', selectedBranch);
            const { data: expenses } = await eQuery;

            // Purchases
            let pQuery = supabase.from('inventory_purchases').select('total_amount, payment_condition')
                .gte('purchase_date', startDate).lte('purchase_date', endDate)
                .eq('status', 'PROCESADO').eq('payment_condition', 'CONTADO');
            if (selectedBranch !== 'ALL') pQuery = pQuery.eq('branch_id', selectedBranch);
            const { data: purchases } = await pQuery;

            let vEfectivo = 0, vTarjeta = 0, vCredito = 0, vOtros = 0;
            let pEfectivo = 0, pTarjeta = 0, pOtros = 0;
            let descuentos = 0, oAtendidas = 0, oAnuladas = 0, comensales = 0;

            if (orders) {
                orders.forEach((o: any) => {
                    if (o.status === 'cancelled') {
                        oAnuladas++;
                    } else {
                        oAtendidas++;
                        comensales += (Number(o.pax_count) || 0);

                        // Sum global order discount
                        descuentos += (Number(o.discount_amount) || 0);

                        // Sum items discounts
                        if (o.order_items && Array.isArray(o.order_items)) {
                            descuentos += o.order_items.reduce((acc: number, item: any) => acc + (Number(item.discount_amount) || 0), 0);
                        }

                        const total = Number(o.total) || 0;
                        const propina = Number(o.tip_amount) || 0;
                        const method = (o.payment_method || 'EFECTIVO').toUpperCase();

                        if (method === 'EFECTIVO') { vEfectivo += total; pEfectivo += propina; }
                        else if (method.includes('TARJETA')) { vTarjeta += total; pTarjeta += propina; }
                        else if (method === 'CREDITO' || method === 'CRÉDITO') { vCredito += total; pOtros += propina; }
                        else { vOtros += total; pOtros += propina; }
                    }
                });
            }

            const totalVentas = vEfectivo + vTarjeta + vCredito + vOtros;
            const totalPropinas = pEfectivo + pTarjeta + pOtros;
            const totalGastos = expenses?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
            const totalCompras = purchases?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0;
            const totalEgresos = totalCompras + totalGastos + descuentos;

            setReportData({
                ventas: { efectivo: vEfectivo, tarjeta: vTarjeta, credito: vCredito, otros: vOtros, total: totalVentas },
                propinas: { efectivo: pEfectivo, tarjeta: pTarjeta, otros: pOtros, total: totalPropinas },
                egresos: { compras: totalCompras, gastos: totalGastos, descuentos, total: totalEgresos },
                ordenes: { atendidas: oAtendidas, anuladas: oAnuladas, comensales },
                ticket: { porPersona: comensales > 0 ? (totalVentas / comensales) : 0, porOrden: oAtendidas > 0 ? (totalVentas / oAtendidas) : 0 }
            });
        } catch (error) {
            console.error("Error al generar:", error);
            alert("Error obteniendo datos.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintTicket = async () => {
        const branchName = selectedBranch === 'ALL' ? 'TODAS LAS SUCURSALES' : (branches.find(b => b.id === selectedBranch)?.name || 'N/A');
        await printService.printGeneralReport(reportData, startDate, endDate, branchName);
    };

    const formatCurr = (val: number) => `Q${val.toFixed(2)}`;

    if (!isVisible) {
        return (
            <div className="w-full h-full flex items-center justify-center p-4 bg-[#e5e7eb]">
                <span className="text-gray-400 font-bold tracking-widest uppercase">Seleccione una opción del menú</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center p-4 bg-[#e5e7eb] text-black">
            {typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] pointer-events-none flex items-center justify-center p-4">
                    <DraggableWindow>
                        <div className="w-[850px] bg-[#f0f0f0] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-[#106ebe] flex flex-col flex-shrink-0 animate-fade-in relative pointer-events-auto">
                            {/* Header Clásico Windows */}
                            <div className="modal-header bg-[#106ebe] h-8 px-2 flex justify-between items-center select-none text-white cursor-move active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold tracking-wide ml-2">Reporte General</span>
                                </div>
                                <div className="flex items-center">
                                    <button onClick={() => setIsVisible(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                        <X size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Contenido */}
                            <div className="p-4 flex flex-col gap-4">

                                {/* Sección 1: Configuración */}
                                <div className="border border-gray-300 relative pt-4 pb-3 px-3">
                                    <span className="absolute -top-2 left-2 bg-[#f0f0f0] px-1 text-[11px] font-bold text-gray-700">Configuración</span>
                                    <div className="flex items-center justify-between gap-4">
                                        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="border border-gray-400 bg-white text-[11px] px-2 py-1 h-7 w-[200px] outline-none shadow-sm focus:border-blue-500 uppercase text-black">
                                            <option value="ALL">TODAS LAS SUCURSALES</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-gray-700">Del</span>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] text-black px-2 py-1 h-7 outline-none shadow-sm focus:border-blue-500" />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-gray-700">Al</span>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] text-black px-2 py-1 h-7 outline-none shadow-sm focus:border-blue-500" />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button onClick={handleGenerate} disabled={loading} className="bg-[#f0f0f0] border border-gray-400 hover:bg-[#e0e0e0] active:bg-[#d0d0d0] text-black text-[11px] px-4 py-1.5 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                                                {loading && <Loader2 size={12} className="animate-spin" />} Generar
                                            </button>
                                            <button onClick={handlePrintTicket} className="bg-[#f0f0f0] border border-gray-400 hover:bg-[#e0e0e0] active:bg-[#d0d0d0] text-black text-[11px] px-4 py-1.5 shadow-sm transition-all">
                                                Imprimir
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sección 2: Ventas / Propinas / Gastos */}
                                <div className="border border-gray-300 relative pt-5 pb-4 px-3">
                                    <span className="absolute -top-2 left-2 bg-[#f0f0f0] px-1 text-[11px] font-bold text-gray-700">Ventas / Propinas / Gastos</span>

                                    <div className="flex flex-col gap-4">
                                        {/* Fila Ventas */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-32"><span className="text-[11px] font-bold text-gray-900">Ventas</span></div>
                                            <div className="flex-1 grid grid-cols-5 gap-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Efectivo</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ventas.efectivo)} className="w-full h-7 text-center text-[11px] text-black font-bold border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Tarjeta</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ventas.tarjeta)} className="w-full h-7 text-center text-[11px] text-black font-bold border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Al Crédito</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ventas.credito)} className="w-full h-7 text-center text-[11px] text-black font-bold border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Otros</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ventas.otros)} className="w-full h-7 text-center text-[11px] text-black font-bold border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] font-bold text-gray-900">TOTAL</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ventas.total)} className="w-full h-7 text-center text-[11px] text-black font-black border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fila Propinas */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-32"><span className="text-[11px] font-bold text-gray-900">Propinas</span></div>
                                            <div className="flex-1 grid grid-cols-5 gap-4">
                                                <div className="flex flex-col items-center">
                                                    <input type="text" readOnly value={formatCurr(reportData.propinas.efectivo)} className="w-full h-7 mt-4 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <input type="text" readOnly value={formatCurr(reportData.propinas.tarjeta)} className="w-full h-7 mt-4 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center"></div> {/* Espacio vacío para Crédito */}
                                                <div className="flex flex-col items-center">
                                                    <input type="text" readOnly value={formatCurr(reportData.propinas.otros)} className="w-full h-7 mt-4 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <input type="text" readOnly value={formatCurr(reportData.propinas.total)} className="w-full h-7 mt-4 text-center text-black font-black text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fila Egresos */}
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="w-32"><span className="text-[11px] font-bold text-gray-900">Egresos y Descuentos</span></div>
                                            <div className="flex-1 grid grid-cols-5 gap-4">
                                                <div className="flex flex-col items-center gap-1 col-start-2">
                                                    <span className="text-[10px] text-gray-600">Compras</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.egresos.compras)} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Gastos</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.egresos.gastos)} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Descuentos</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.egresos.descuentos)} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] font-bold text-gray-900">TOTAL</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.egresos.total)} className="w-full h-7 text-center text-black font-black text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-center mt-1">
                                            <span className="text-[9px] text-gray-500">*Gastos = Compras pagadas desde Caja + Gastos de Caja</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sección 3: Ordenes / Ticket */}
                                <div className="border border-gray-300 relative pt-6 pb-4 px-3 h-[110px]">
                                    <span className="absolute -top-2 left-2 bg-[#f0f0f0] px-1 text-[11px] font-bold text-gray-700">Ordenes / Ticket Promedio</span>

                                    <div className="flex h-full">
                                        {/* Bloque Izquierdo */}
                                        <div className="w-3/5 flex flex-col justify-center items-center">
                                            <span className="text-[11px] font-bold text-gray-900 mb-2">Ordenes y Comensales</span>
                                            <div className="grid grid-cols-3 gap-6 w-full px-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Ordenes Atendidas</span>
                                                    <input type="text" readOnly value={reportData.ordenes.atendidas} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Ordenes Anuladas</span>
                                                    <input type="text" readOnly value={reportData.ordenes.anuladas} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Comensales Atendidos</span>
                                                    <input type="text" readOnly value={reportData.ordenes.comensales} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Separador */}
                                        <div className="w-px bg-gray-300 mx-4 h-full"></div>

                                        {/* Bloque Derecho */}
                                        <div className="w-2/5 flex flex-col justify-center items-center">
                                            <span className="text-[11px] font-bold text-gray-900 mb-2">Ticket Promedio</span>
                                            <div className="grid grid-cols-2 gap-6 w-full px-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Por Persona</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ticket.porPersona)} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-gray-600">Por Orden / Mesa</span>
                                                    <input type="text" readOnly value={formatCurr(reportData.ticket.porOrden)} className="w-full h-7 text-center text-black font-bold text-[11px] border border-gray-400 bg-gray-50 cursor-default" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
                , document.body)}
        </div>
    );
};
