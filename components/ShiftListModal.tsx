import React, { useState, useEffect } from 'react';
import { X, Printer, Mail } from 'lucide-react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';

interface Shift {
    id: string;
    cash_register_id: string;
    cashier_id: string;
    start_time: string;
    end_time: string | null;
    start_amount: number;
    end_amount: number | null;
    status: 'OPEN' | 'CLOSED';
    counted_amount: number;
    difference_amount: number;
    cash_detail: any;
    closing_notes: string | null;
    shift_number?: number;
    cash_registers?: {
        name: string;
    };
    profiles?: {
        name: string;
    };
}

interface ShiftListModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShiftListModal: React.FC<ShiftListModalProps> = ({ isOpen, onClose }) => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingShiftId, setProcessingShiftId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchShifts();
        }
    }, [isOpen]);

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const branchId = cachedUser?.branch_id;

            let query = supabase
                .from('shifts')
                .select(`
                    *,
                    cash_registers!inner (name, branch_id),
                    profiles (name)
                `)
                .eq('status', 'CLOSED')
                .order('end_time', { ascending: false })
                .limit(50);

            if (branchId) {
                query = query.eq('cash_registers.branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            const fetchedShifts = data || [];
            setShifts(fetchedShifts);
            if (fetchedShifts.length > 0) {
                setSelectedShift(fetchedShifts[0]);
            } else {
                setSelectedShift(null);
            }
        } catch (e: any) {
            console.error('Error fetching shifts:', e);
        }
        setLoading(false);
    };

    const getShiftReportData = async (shift: Shift) => {
        try {
            // Fetch all orders for this shift
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        products (name)
                    )
                `)
                .eq('shift_id', shift.id);

            if (ordersError) throw ordersError;

            // Fetch expenses for this shift
            const { data: expenses, error: expensesError } = await supabase
                .from('expenses')
                .select('*')
                .eq('shift_id', shift.id)
                .eq('is_void', false);

            if (expensesError) throw expensesError;

            // Calculate sales by method
            const salesByMethod: { [key: string]: number } = {};
            const tipsByMethod: { [key: string]: number } = {};
            const salesByChannel: { [key: string]: number } = {};
            let totalSales = 0;
            let totalTips = 0;
            let totalExpenses = 0;

            orders?.forEach((order: any) => {
                if (order.status === 'completed') {
                    const method = order.payment_method || 'EFECTIVO';
                    const channel = order.order_type || 'DINE_IN';
                    const subtotal = (order.subtotal || 0) + (order.tax_amount || 0);
                    const tip = order.tip_amount || 0;

                    salesByMethod[method] = (salesByMethod[method] || 0) + subtotal;
                    totalSales += subtotal;

                    if (tip > 0) {
                        const tipMethod = order.tip_method || 'EFECTIVO';
                        tipsByMethod[tipMethod] = (tipsByMethod[tipMethod] || 0) + tip;
                        totalTips += tip;
                    }

                    const channelName =
                        channel === 'DINE_IN' ? 'SERVICIO MESAS' :
                        channel === 'TAKEOUT' ? 'PARA LLEVAR' :
                        channel === 'DELIVERY' ? 'A DOMICILIO' :
                        channel === 'PICKUP' ? 'PICKUP' :
                        channel === 'QUICK_SALE' ? 'VENTA RÁPIDA' : 'PLATAFORMAS';

                    salesByChannel[channelName] = (salesByChannel[channelName] || 0) + subtotal;
                }
            });

            expenses?.forEach((expense: any) => {
                totalExpenses += expense.amount || 0;
            });

            // Calculate cash detail
            const cashSales = salesByMethod['EFECTIVO'] || 0;
            const cashTips = tipsByMethod['EFECTIVO'] || 0;
            const expectedCash = (shift.start_amount || 0) + cashSales + cashTips - totalExpenses;

            // Build report data
            const reportData = {
                type: 'Z' as const,
                shiftId: shift.id,
                cashierName: shift.profiles?.name || 'Sin nombre',
                registerName: shift.cash_registers?.name || 'Sin nombre',
                startTime: shift.start_time,
                endTime: shift.end_time || new Date().toISOString(),
                startAmount: shift.start_amount || 0,
                salesTotal: totalSales,
                expensesTotal: totalExpenses,
                expectedCash: expectedCash,
                countedCash: shift.counted_amount || 0,
                difference: (shift.counted_amount || 0) - expectedCash,
                stats: {
                    ordersAttended: orders?.filter((o: any) => o.status === 'completed').length || 0,
                    deletedPlates: 0,
                    cancelledOrders: orders?.filter((o: any) => o.status === 'cancelled').length || 0,
                    commensals: orders?.reduce((acc: number, o: any) => acc + (o.pax_count || 0), 0) || 0,
                    openOrders: orders?.filter((o: any) => o.status !== 'completed' && o.status !== 'cancelled').length || 0,
                },
                salesByMethod: Object.entries(salesByMethod).map(([method, amount]) => ({ method, amount })),
                tipsByMethod: Object.entries(tipsByMethod).map(([method, amount]) => ({ method, amount })),
                salesByChannel: Object.entries(salesByChannel).map(([channel, amount]) => ({ channel, amount })),
                cashDetail: {
                    initial: shift.start_amount || 0,
                    sales: cashSales,
                    abonos: 0,
                    tips: cashTips,
                    expenses: totalExpenses,
                    total: expectedCash,
                },
                denominations: shift.cash_detail || {},
                notes: shift.closing_notes || '',
                abonosByMethod: [],
                posCardDetail: [],
                expenses: expenses || [],
            };

            return reportData;
        } catch (error) {
            console.error('Error getting shift report data:', error);
            throw error;
        }
    };

    const handlePrint = async (shift: Shift) => {
        setProcessingShiftId(shift.id);
        try {
            const reportData = await getShiftReportData(shift);
            await printService.printZReport(reportData);
            
            // Re-print expenses summary if any
            if (reportData.expensesTotal > 0) {
                await printService.printExpensesSummary(reportData);
            }

            // Law of the user: When printing is done, send email automatically
            try {
                await handleEmail(shift);
            } catch (e) {
                console.error('Error sending auto-email from history:', e);
            }
        } catch (error: any) {
            console.error('Error printing shift:', error);
        } finally {
            setProcessingShiftId(null);
        }
    };

    const handleEmail = async (shift: Shift) => {
        setProcessingShiftId(shift.id);
        try {
            // Get system settings to retrieve cashier emails and SMTP config
            const { data: settings, error: settingsError } = await supabase
                .from('system_settings')
                .select('cashier_emails, restaurant_name, smtp_host, smtp_port, smtp_user, smtp_pass')
                .single();

            if (settingsError) throw settingsError;

            if (!settings?.cashier_emails) {
                alert('No hay correos destinatarios configurados en Administración.');
                return;
            }

            if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) {
                alert('No hay configuración de Servidor SMTP (remitente) guardada en Administración.');
                return;
            }

            const reportData = await getShiftReportData(shift);

            // Format email content
            const emailSubject = `Reporte de Cierre - ${shift.profiles?.name} - ${formatDate(shift.end_time)}`;
            const emailBody = `
REPORTE DE CIERRE DE TURNO
${settings.restaurant_name || 'RESTAURANTE'}
═══════════════════════════════════════

INFORMACIÓN DEL TURNO
─────────────────────────────────────
Caja: ${shift.cash_registers?.name || 'Sin nombre'}
Cajero: ${shift.profiles?.name || 'Sin nombre'}
Apertura: ${formatDateTime(shift.start_time)}
Cierre: ${formatDateTime(shift.end_time)}

ESTADÍSTICAS
─────────────────────────────────────
Órdenes Atendidas: ${reportData.stats.ordersAttended}
Órdenes Anuladas: ${reportData.stats.cancelledOrders}
Comensales: ${reportData.stats.commensals}
Órdenes Abiertas: ${reportData.stats.openOrders}

VENTAS POR MÉTODO DE PAGO
─────────────────────────────────────
${reportData.salesByMethod.map(s => `${s.method}: Q${s.amount.toFixed(2)}`).join('\n')}
─────────────────────────────────────
TOTAL VENTAS: Q${reportData.salesTotal.toFixed(2)}

PROPINAS
─────────────────────────────────────
${reportData.tipsByMethod.length > 0
                    ? reportData.tipsByMethod.map(t => `${t.method}: Q${t.amount.toFixed(2)}`).join('\n')
                    : 'Sin propinas'}
─────────────────────────────────────
TOTAL PROPINAS: Q${reportData.tipsByMethod.reduce((acc, t) => acc + t.amount, 0).toFixed(2)}

VENTAS POR CANAL
─────────────────────────────────────
${reportData.salesByChannel.map(c => `${c.channel}: Q${c.amount.toFixed(2)}`).join('\n')}

CUADRE DE EFECTIVO
─────────────────────────────────────
(+) Inicial: Q${reportData.cashDetail.initial.toFixed(2)}
(+) Ventas: Q${reportData.cashDetail.sales.toFixed(2)}
(+) Propinas: Q${reportData.cashDetail.tips.toFixed(2)}
(-) Gastos: Q${reportData.cashDetail.expenses.toFixed(2)}
─────────────────────────────────────
ESPERADO: Q${reportData.expectedCash.toFixed(2)}
CONTADO: Q${reportData.countedCash.toFixed(2)}
DIFERENCIA: Q${reportData.difference.toFixed(2)} ${reportData.difference === 0 ? '✓ CUADRADO' : (reportData.difference > 0 ? '(SOBRANTE)' : '(FALTANTE)')}

${reportData.notes ? `\nNOTAS DE CIERRE:\n${reportData.notes}` : ''}

═══════════════════════════════════════
Generado: ${new Date().toLocaleString('es-GT')}
            `.trim();

            // Send email via Electron backend
            const electron = (window as any).electronAPI || (window as any).electron;
            if (!electron) {
                alert('La funcionalidad de correo no está disponible en este dispositivo/navegador.');
                return;
            }

            const response = await electron.sendEmail({
                to: settings.cashier_emails,
                subject: emailSubject,
                body: emailBody,
                smtpConfig: {
                    host: settings.smtp_host,
                    port: settings.smtp_port ? parseInt(settings.smtp_port) : 465,
                    user: settings.smtp_user,
                    pass: settings.smtp_pass
                }
            });

            if (response.success) {
                alert('¡Correo enviado exitosamente!');
            } else {
                alert('Error al enviar correo: ' + response.error);
                console.error('SMTP Error:', response.error);
            }
        } catch (error: any) {
            console.error('Error sending email:', error);
            alert('Error en sistema al intentar enviar correo: ' + error.message);
        } finally {
            setProcessingShiftId(null);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80  z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-3xl bg-[#2e303f] rounded-[4px] border border-white/10  overflow-hidden flex flex-col">
                {/* HEADER */}
                <div className="bg-[#212330] py-3.5 px-4 flex justify-between items-center border-b border-white/5 relative">
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.25em] mx-auto">
                        LISTADO DE CIERRES
                    </span>
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 min-h-[300px] max-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : shifts.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-gray-400 text-sm font-bold">No hay cierres registrados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {shifts.map((shift) => {
                                const isSelected = selectedShift?.id === shift.id;
                                return (
                                    <div
                                        key={shift.id}
                                        onClick={() => setSelectedShift(shift)}
                                        className={`border rounded-[4px] px-3 py-1.5 flex flex-col justify-between h-[76px] transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-[#5c6bc0] border-white/20  scale-[1.02]'
                                                : 'bg-[#383b4d] border-white/5 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center text-[10px] leading-tight">
                                            <span className={isSelected ? 'text-white/70' : 'text-white/50'}>Caja</span>
                                            <span className="font-bold text-white text-right">{shift.cash_registers?.name || 'Caja'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] leading-tight">
                                            <span className={isSelected ? 'text-white/70' : 'text-white/50'}>Turno</span>
                                            <span className="font-bold text-white text-right">{shift.shift_number || 1}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] leading-tight">
                                            <span className={isSelected ? 'text-white/70' : 'text-white/50'}>Apertura</span>
                                            <span className="font-bold text-white text-right">{formatDate(shift.start_time)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] leading-tight">
                                            <span className={isSelected ? 'text-white/70' : 'text-white/50'}>Cierre</span>
                                            <span className="font-bold text-white text-right">{formatDate(shift.end_time)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* FOOTER ACTION BUTTONS */}
                <div className="p-6 bg-[#212330]/30 border-t border-white/5 flex justify-center gap-4">
                    <button
                        onClick={() => selectedShift && handlePrint(selectedShift)}
                        disabled={!selectedShift || processingShiftId !== null}
                        className="relative w-[150px] h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-bold text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all  active:scale-95 overflow-hidden disabled:opacity-50"
                    >
                        {processingShiftId === selectedShift?.id ? (
                            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            'IMPRIMIR'
                        )}
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-yellow-500 border-l-[10px] border-l-transparent pointer-events-none" />
                    </button>

                    <button
                        onClick={() => selectedShift && handleEmail(selectedShift)}
                        disabled={!selectedShift || processingShiftId !== null}
                        className="relative w-[150px] h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-bold text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all  active:scale-95 overflow-hidden disabled:opacity-50"
                    >
                        {processingShiftId === selectedShift?.id ? (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            'ENVIAR CORREO'
                        )}
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-blue-500 border-l-[10px] border-l-transparent pointer-events-none" />
                    </button>

                    <button
                        onClick={onClose}
                        className="relative w-[150px] h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-bold text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all  active:scale-95 overflow-hidden"
                    >
                        CERRAR
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-red-500 border-l-[10px] border-l-transparent pointer-events-none" />
                    </button>
                </div>
            </div>
        </div>
    );
};

