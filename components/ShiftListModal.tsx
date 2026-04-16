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
            setShifts(data || []);
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
                                    channel === 'QUICK_SALE' ? 'VENTA RÁPIDA' : channel;

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
                    deletedPlates: 0, // TODO: Calculate from order_items if tracked
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
                    abonos: 0, // TODO: Add credit payments if tracked
                    tips: cashTips,
                    expenses: totalExpenses,
                    total: expectedCash,
                },
                denominations: shift.cash_detail || {},
                notes: shift.closing_notes || '',
                abonosByMethod: [], // TODO: Add if credit payments are tracked
                posCardDetail: [], // TODO: Add POS terminal breakdown if needed
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
            const response = await (window as any).electron.sendEmail({
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            <div className="bg-[#14171c] w-full max-w-[95vw] lg:max-w-7xl max-h-[92vh] rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                {/* HEADER */}
                <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-0.5">Historial de Turnos</span>
                        <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">LISTADO DE CIERRES</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white/5 rounded-full text-gray-600 hover:text-white transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : shifts.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-gray-500 text-lg font-bold">No hay cierres registrados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className="bg-[#1e212b] rounded-2xl border border-white/5 p-4 flex flex-col transition-all hover:bg-[#2b2f3a] hover:border-emerald-500/20 group shadow-lg"
                                >
                                    {/* Cabecera Tarjeta: Caja y Cajero */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                            <Printer size={18} className="text-emerald-400" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{shift.cash_registers?.name || 'Caja'}</span>
                                            <span className="text-xs font-bold text-white truncate leading-tight mt-0.5">{shift.profiles?.name || 'Sin nombre'}</span>
                                        </div>
                                    </div>

                                    {/* Fechas Compactas */}
                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">Inicio</span>
                                            <span className="text-[10px] font-black text-gray-300">{formatDateTime(shift.start_time).split(',')[0]}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">Fin</span>
                                            <span className="text-[10px] font-black text-emerald-400">{formatDateTime(shift.end_time).split(',')[0]}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                                        <button
                                            onClick={() => handlePrint(shift)}
                                            disabled={processingShiftId === shift.id}
                                            className="h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center gap-2 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                                        >
                                            {processingShiftId === shift.id ? (
                                                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <Printer size={12} />
                                                    Print
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleEmail(shift)}
                                            disabled={processingShiftId === shift.id}
                                            className="h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                                        >
                                            {processingShiftId === shift.id ? (
                                                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <Mail size={12} />
                                                    Enviar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 md:p-8 bg-[#0d0f13] border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="h-12 px-8 rounded-xl border border-white/10 bg-white/5 font-black uppercase tracking-[0.2em] text-[10px] text-gray-500 hover:text-white transition-all active:scale-95"
                    >
                        CERRAR
                    </button>
                </div>
            </div>
        </div>
    );
};

