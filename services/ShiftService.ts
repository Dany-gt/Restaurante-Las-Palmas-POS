import { supabase } from '../supabase';
import { User } from '../types';

export interface ShiftStats {
    ordersAttended: number;
    deletedPlates: number;
    cancelledOrders: number;
    commensals: number;
    openOrders: number;
    assignedOrders: number;
}

export interface ShiftOrder {
    id: string;
    orderNumber: string;
    table: string;
    waiter: string;
    createdAt: string;
    total: number;
    paymentMethod: string;
    tip: number;
    tipCash: number;
    tipCard: number;
    tipOther: number;
    posTerminalId?: string | null; // POS terminal ID for card payments
    tables?: { number: any; section: any }; // Joined table data
}

export interface ShiftReportData {
    type: 'X' | 'Z';
    shiftId: string;
    cashierName: string;
    startTime: string;
    endTime: string;
    startAmount: number;
    salesTotal: number;
    expensesTotal: number;
    expectedCash: number;
    countedCash: number;
    difference: number;
    stats: ShiftStats;
    isCounted?: boolean;
    salesByMethod: { method: string; amount: number }[];
    abonosByMethod: { method: string; amount: number }[];
    tipsByMethod: { method: string; amount: number }[];
    salesByChannel: { channel: string; amount: number }[];
    orders: ShiftOrder[];
    cashDetail: {
        initial: number;
        sales: number;
        abonos: number;
        tips: number;
        expenses: number;
        total: number;
    };
    denominations?: {
        monedas: any[];
        billetes: any[];
    };
    posCardDetail: { name: string; total: number }[];
    expenses?: any[]; // Detailed expense list
    notes?: string;
    shiftNumber?: number | null; // Sequential turn number from DB
}

export const shiftService = {
    /**
     * Calculates shift statistics and totals based on the current open shift for a user.
     */
    async getShiftData(user: User): Promise<{
        shift: any;
        reportData: ShiftReportData | null;
        error: string | null;
    }> {
        try {
            // Find open shift for user — open means NO end_time recorded yet
            const { data: shiftRows } = await supabase
                .from('shifts')
                .select('*')
                .eq('cashier_id', user.id)
                .is('end_time', null)
                .order('start_time', { ascending: false })
                .limit(1);

            const shift = shiftRows?.[0] || null;

            if (!shift) {
                return { shift: null, reportData: null, error: 'No se encontró un turno abierto.' };
            }

            // 1. Fetch tables map
            const { data: tablesData } = await supabase.from('tables').select('id, name, number');
            const tablesMap: Record<string, string> = {};

            // Helper function to extract table number from table name
            const extractTableNumber = (tableName: string | null, tableNumber: number | null): string => {
                // If we have a direct number, use it
                if (tableNumber) return tableNumber.toString();

                if (!tableName) return '---';

                // Remove common prefixes and extract just the number
                let cleaned = tableName.trim();

                // Remove 'M ', 'M.', 'M-', 'MESA ', 'Mesa ' prefixes
                cleaned = cleaned.replace(/^(M\s*[-\.]?\s*|MESA\s+|Mesa\s+)/i, '');

                // Remove transaction IDs (T followed by numbers) and everything after
                cleaned = cleaned.replace(/\s*T\d+.*$/i, '');

                // Extract first number found
                const numberMatch = cleaned.match(/^(\d+)/);
                if (numberMatch) {
                    return numberMatch[1];
                }

                // If no number found, return original cleaned text
                return cleaned;
            };

            tablesData?.forEach((t: any) => {
                tablesMap[t.id] = extractTableNumber(t.name, t.number);
            });

            // 1b. Fetch waiters map from profiles
            const { data: usersData } = await supabase.from('profiles').select('id, name');
            const waitersMap: Record<string, string> = {};
            usersData?.forEach((u: any) => {
                waitersMap[u.id] = u.name || 'Mesero';
            });

            // 2. Fetch ALL orders from the shift
            const { data: shiftOrders, error: ordersError } = await supabase
                .from('orders')
                .select(`
                    id, 
                    order_number,
                    created_at, 
                    total, 
                    subtotal, 
                    tax_amount, 
                    tip_amount, 
                    payment_method, 
                    order_type, 
                    pax_count, 
                    status,
                    table_id,
                    waiter_id,
                    tip_method,
                    tables!table_id(number, section)
                `)
                .gte('created_at', shift.start_time);

            if (ordersError) throw ordersError;

            // 2. Fetch expenses
            const { data: shiftExpenses } = await supabase
                .from('expenses')
                .select('*')
                .gte('created_at', shift.start_time)
                .eq('shift_id', shift.id)
                .eq('is_void', false)
                .order('created_at', { ascending: false });

            // 2b. Fetch credit payments (abonos) during this shift
            const { data: creditPayments } = await supabase
                .from('receivables_transactions_detail')
                .select('*')
                .eq('transaction_type', 'PAYMENT')
                .gte('fecha_transaccion', shift.start_time);

            // 3. Initialize collectors
            const salesByMethodMap: Record<string, number> = { 'EFECTIVO': 0, 'TARJETA': 0, 'CRÉDITO': 0, 'OTROS': 0 };
            const tipsByMethodMap: Record<string, number> = { 'EFECTIVO': 0, 'TARJETA': 0, 'OTROS': 0 };
            const abonosByMethodMap: Record<string, number> = { 'EFECTIVO': 0, 'TARJETA': 0, 'TRANSFERENCIA': 0, 'CHEQUE': 0, 'OTROS': 0 };
            const salesByChannelMap: Record<string, number> = { 'RESTAURANTE': 0, 'PARA LLEVAR': 0, 'A DOMICILIO': 0, 'PLATAFORMAS': 0, 'PICKUP': 0 };

            const stats: ShiftStats = {
                ordersAttended: 0,
                deletedPlates: 0,
                cancelledOrders: 0,
                commensals: 0,
                openOrders: 0,
                assignedOrders: 0
            };

            let totalSales = 0;
            let totalTips = 0;
            let totalAbonos = 0;
            const detailedOrders: ShiftOrder[] = [];

            // Process credit payments
            creditPayments?.forEach((payment: any) => {
                const amount = Number(payment.monto || 0);
                const method = (payment.metodo_pago || 'EFECTIVO').toUpperCase();
                const methodKey = abonosByMethodMap.hasOwnProperty(method) ? method : 'OTROS';
                abonosByMethodMap[methodKey] += amount;
                totalAbonos += amount;
            });

            shiftOrders?.forEach((o: any) => {
                if (o.status === 'completed') {
                    stats.ordersAttended++;
                    stats.commensals += (o.pax_count || 0);

                    const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                    const methodKey = salesByMethodMap.hasOwnProperty(method) ? method : 'OTROS';
                    const netTotal = Number(o.total || 0) - Number(o.tip_amount || 0);
                    salesByMethodMap[methodKey] += netTotal;
                    totalSales += netTotal;

                    // Tips breakdown
                    const tip = Number(o.tip_amount || 0);
                    let tipCash = 0;
                    let tipCard = 0;
                    let tipOther = 0;

                    if (tip > 0) {
                        // Use the explicitly recorded tip_method if available, otherwise fallback to payment method logic
                        const tipMethod = (o.tip_method || (method === 'EFECTIVO' ? 'EFECTIVO' : (method === 'TARJETA' ? 'TARJETA' : 'OTROS'))).toUpperCase();

                        const tipMethodKey = tipMethod === 'EFECTIVO' ? 'EFECTIVO' : (tipMethod === 'TARJETA' ? 'TARJETA' : 'OTROS');
                        tipsByMethodMap[tipMethodKey] += tip;
                        totalTips += tip;

                        if (tipMethod === 'TARJETA') {
                            tipCard = tip;
                        } else if (tipMethod === 'EFECTIVO') {
                            tipCash = tip;
                        } else {
                            tipOther = tip;
                        }
                    }

                    // Channel breakdown
                    const channel = (o.order_type || 'DINE_IN').toUpperCase();
                    const channelKey = channel === 'DINE_IN' ? 'RESTAURANTE' : (channel === 'TAKEOUT' ? 'PARA LLEVAR' : (channel === 'DELIVERY' ? 'A DOMICILIO' : 'PLATAFORMAS'));
                    salesByChannelMap[channelKey] += Number(o.total || 0);

                    // Add to detailed list
                    detailedOrders.push({
                        id: o.id,
                        orderNumber: o.order_number ? `#${o.order_number}` : '---',
                        table: tablesMap[o.table_id] || (o.table_id ? `#${o.table_id}` : (o.order_type === 'TAKEOUT' ? 'LLEVAR' : (o.order_type === 'DELIVERY' ? 'DOMICILIO' : '---'))),
                        waiter: waitersMap[o.waiter_id] || '---',
                        createdAt: o.created_at,
                        total: Number(o.total || 0),
                        paymentMethod: method,
                        tip: tip,
                        tipCash: tipCash,
                        tipCard: tipCard,
                        tipOther: tipOther,
                        posTerminalId: o.pos_terminal_id || null, // Include terminal ID
                        tables: o.tables
                    });

                } else if (o.status === 'cancelled') {
                    stats.cancelledOrders++;
                } else if (['pending', 'preparing', 'ready', 'delivering'].includes(o.status)) {
                    stats.openOrders++;
                    // Check if assigned to the current user (waiter_id match)
                    if (o.waiter_id && user?.id && o.waiter_id.toString().toLowerCase() === user.id.toString().toLowerCase()) {
                        stats.assignedOrders++;
                    }
                }
            });

            const totalExpenses = shiftExpenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
            const totalCashIn = salesByMethodMap['EFECTIVO'] + tipsByMethodMap['EFECTIVO'] + abonosByMethodMap['EFECTIVO'];
            const expectedCash = Number(shift.start_amount) + totalCashIn - totalExpenses;

            // Construct preliminary report data (without counted cash/diff)
            const reportData: ShiftReportData = {
                type: 'X', // Default to X, can be overridden
                shiftId: shift.id,
                cashierName: user.name || (user as any).full_name || 'Cajero',
                startTime: shift.start_time,
                endTime: new Date().toISOString(),
                startAmount: Number(shift.start_amount),
                salesTotal: totalSales,
                expensesTotal: totalExpenses,
                expectedCash: expectedCash,
                countedCash: Number(shift.counted_amount || 0),
                difference: Number(shift.difference_amount || 0),
                stats: stats,
                isCounted: shift.counted_amount !== null && shift.counted_amount !== undefined,
                salesByMethod: Object.entries(salesByMethodMap).map(([method, amount]) => ({ method, amount })),
                abonosByMethod: Object.entries(abonosByMethodMap).map(([method, amount]) => ({ method, amount })),
                tipsByMethod: Object.entries(tipsByMethodMap).map(([method, amount]) => ({ method, amount })),
                salesByChannel: Object.entries(salesByChannelMap).map(([channel, amount]) => ({ channel, amount })),
                orders: detailedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                cashDetail: {
                    initial: Number(shift.start_amount),
                    sales: salesByMethodMap['EFECTIVO'],
                    abonos: abonosByMethodMap['EFECTIVO'],
                    tips: tipsByMethodMap['EFECTIVO'],
                    expenses: totalExpenses,
                    total: expectedCash
                },
                posCardDetail: await (async () => {
                    // Fetch configured POS terminals
                    const { data: terminals } = await supabase
                        .from('pos_terminals')
                        .select('id, name')
                        .order('name');

                    if (!terminals || terminals.length === 0) {
                        // Fallback to default terminals if none configured
                        return [
                            { name: 'NEONET', total: salesByMethodMap['TARJETA'] * 0.5 },
                            { name: 'CREDOMATIC', total: salesByMethodMap['TARJETA'] * 0.5 }
                        ];
                    }

                    // Group card sales by actual terminal used
                    const terminalSales: Record<string, number> = {};

                    shiftOrders?.forEach((o: any) => {
                        if (o.status === 'completed' && o.payment_method === 'TARJETA') {
                            const terminalId = o.pos_terminal_id;
                            if (terminalId) {
                                terminalSales[terminalId] = (terminalSales[terminalId] || 0) + Number(o.total || 0);
                            }
                        }
                    });

                    // Build result array with terminal names and totals
                    return terminals.map(t => ({
                        name: t.name,
                        total: terminalSales[t.id] || 0
                    }));
                })(),
                expenses: shiftExpenses || [],
                notes: shift.observaciones || '',
                shiftNumber: shift.shift_number || null
            };

            return { shift, reportData, error: null };

        } catch (err: any) {
            console.error('Error in getShiftData:', err);
            return { shift: null, reportData: null, error: err.message };
        }
    },

    async closeShift(shiftId: string, closingData: {
        end_time: string;
        end_amount: number;
        counted_amount: number;
        difference_amount: number;
        cash_detail: any;
        closing_notes?: string;
    }, cashRegisterId?: number, user?: User) {
        const { error: shiftError } = await supabase
            .from('shifts')
            .update({
                status: 'CLOSED',
                end_time: closingData.end_time,
                end_amount: closingData.end_amount,
                counted_amount: closingData.counted_amount,
                difference_amount: closingData.difference_amount,
                cash_detail: closingData.cash_detail,
                observaciones: closingData.closing_notes || ''
            })
            .eq('id', shiftId);

        if (shiftError) throw shiftError;

        if (cashRegisterId) {
            await supabase
                .from('cash_registers')
                .update({
                    status: 'closed',
                    last_closure_at: closingData.end_time,
                    current_balance: closingData.counted_amount
                })
                .eq('id', cashRegisterId);
        }

        // --- AUTOMATED PROFESSIONAL REPORT BUNDLE ---
        try {
            if (user && (window as any).electron) {
                const { reportData } = await this.getShiftData(user);
                if (reportData) {
                    reportData.type = 'Z';
                    reportData.endTime = closingData.end_time;
                    reportData.countedCash = closingData.counted_amount;
                    reportData.difference = closingData.difference_amount;

                    const { reportTemplates } = await import('./ReportTemplates');
                    const css = `/* report-base.css content */ body { font-family: 'Courier New'; width: 80mm; margin: 0 auto; color: #000; } .header { text-align: center; } .title { text-align: center; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; } .row { display: flex; justify-content: space-between; } .divider { border-top: 1px dashed #000; margin: 8px 0; }`;

                    const generatePdf = async (html: string, name: string) => {
                        const fullHtml = reportTemplates.wrap(html, css);
                        const result = await (window as any).electron.generatePdf(fullHtml, name);
                        return { filename: `${name}.pdf`, content: result.data };
                    };

                    // 1. Fetch products below reorder point (Inventory)
                    const { data: invRaw } = await supabase.from('inventory_items').select('*');
                    const inventoryData = (invRaw || [])
                        .filter(i => Number(i.quantity) <= Number(i.min_stock))
                        .map(i => ({
                            name: i.name,
                            stock: Number(i.quantity),
                            unit: i.unit,
                            category_name: 'Inventario'
                        }));

                    // 2. Fetch sold dishes (Order Items)
                    const { data: itemsRaw } = await supabase
                        .from('order_items')
                        .select('quantity, unit_price, products(name), orders!inner(created_at, status)')
                        .eq('orders.status', 'completed')
                        .gte('orders.created_at', reportData.startTime)
                        .lte('orders.created_at', reportData.endTime);

                    // Group by product name
                    const soldGroups: Record<string, any> = {};
                    (itemsRaw || []).forEach((item: any) => {
                        const name = item.products?.name || 'Producto';
                        if (!soldGroups[name]) soldGroups[name] = { name, quantity: 0, total: 0 };
                        soldGroups[name].quantity += Number(item.quantity);
                        soldGroups[name].total += Number(item.quantity) * Number(item.unit_price);
                    });
                    const soldItems = Object.values(soldGroups).sort((a, b) => b.total - a.total);

                    // 3. Generate PDFs with the DYNAMIC data
                    const attachments = [
                        await generatePdf(reportTemplates.generateCierreCaja(reportData), 'Cierre_Caja'),
                        await generatePdf(reportTemplates.generateCuadreTarjetas(reportData), 'Cuadre_Tarjetas'),
                        await generatePdf(reportTemplates.generateGastos(reportData), 'Resumen_Gastos'),
                        await generatePdf(reportTemplates.generateInventario(inventoryData), 'Inventario'),
                        await generatePdf(reportTemplates.generatePlatosVendidos(soldItems, `${reportData.startTime} - ${reportData.endTime}`), 'Platos_Vendidos')
                    ];

                    const { data: settings } = await supabase.from('system_settings').select('*').single();
                    if (settings?.smtp_user) {
                        await (window as any).electron.sendEmail({
                            to: settings.report_email || settings.smtp_user,
                            subject: `Cierre de Caja - ${reportData.cashierName} - ${new Date().toLocaleDateString()}`,
                            body: `Se adjuntan los 5 reportes operativos del cierre de turno.\nCajero: ${reportData.cashierName}\nFecha: ${new Date().toLocaleString()}`,
                            smtpConfig: {
                                host: settings.smtp_host,
                                port: settings.smtp_port,
                                user: settings.smtp_user,
                                pass: settings.smtp_pass
                            },
                            attachments
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error generating/sending reports bundle:', e);
        }
    }
};
