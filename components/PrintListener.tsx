import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';

export const RemotePrintListener: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
    const [cajaIp, setCajaIp] = useState<string>('192.168.88.11');

    // ═══ DEDUP: Blocks duplicate processing ═══
    const processedIds = useRef(new Set<string>());
    const processingNow = useRef(new Set<string>());

    useEffect(() => {
        // ═══ ELECTRON-ONLY: Only the Caja processes remote prints ═══
        if (!(window as any).electron) {
            console.log('ℹ️ [PrintListener] No es Electron — impresión automática solo disponible en la Caja.');
            return;
        }

        setIsListening(true);
        console.log('🖨️ [PrintListener] Servicio de impresión remota ACTIVADO (Electron)');

        // Hydrate from localStorage
        try {
            const cached = JSON.parse(localStorage.getItem('pl_processed_ids') || '[]');
            cached.forEach((id: string) => processedIds.current.add(id));
        } catch { /* ignore */ }

        printService.getPrinterIP('CAJA').then(ip => {
            if (ip) setCajaIp(ip);
        });

        // ═══ RECOVER STUCK PRINTS ═══
        const recoverPendingPrints = async () => {
            try {
                const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                let query = supabase.from('orders')
                    .select('*')
                    .eq('requires_printing', true)
                    .in('print_status', ['pending', 'pre_check_pending']);
                    
                if (cachedUser?.branch_id) {
                    query = query.eq('branch_id', cachedUser.branch_id);
                }
                
                const { data: pendingOrders } = await query;
                if (pendingOrders && pendingOrders.length > 0) {
                    console.log(`🖨️ [PrintListener] Recuperando ${pendingOrders.length} impresiones estancadas...`);
                    for (const order of pendingOrders) {
                        const preKey = `precheck_${order.id}`;
                        if (!processedIds.current.has(preKey)) {
                            await processPreCheck(order);
                        }
                    }
                }
            } catch (e) {
                console.error('Error recuperando impresiones:', e);
            }
        };
        recoverPendingPrints();

        const subscription = supabase
            .channel('remote_printing')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                },
                async (payload) => {
                    const order = payload.new as any;
                    if (!order || !order.id) return;

                    // Branch isolation: only process orders from our branch
                    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    if (cachedUser?.branch_id && order.branch_id && order.branch_id !== cachedUser.branch_id) return;

                    // ═══ UNIVERSAL PRINT DETECTION ═══
                    if ((order.print_status === 'pending' || order.print_status === 'pre_check_pending') && order.requires_printing) {
                        const preKey = `precheck_${order.id}`;
                        if (processedIds.current.has(preKey)) {
                            console.log(`🛡️ ${order.id} BLOCKED (already processed)`);
                            await supabase.from('orders').update({ print_status: 'printed', requires_printing: false }).eq('id', order.id);
                            return;
                        }
                        console.log('🖨️ [PrintListener] Ticket detectado:', order.id, order.print_status);
                        await processPreCheck(order);
                        return;
                    }

                    // ALL OTHER events → IGNORED
                }
            )
            .subscribe();

        // Network ping
        const pingInterval = setInterval(async () => {
            const isAlive = await printService.checkConnection(cajaIp);
            setNetworkStatus(isAlive ? 'online' : 'offline');
        }, 30000);

        printService.checkConnection(cajaIp).then(alive => setNetworkStatus(alive ? 'online' : 'offline'));

        return () => {
            supabase.removeChannel(subscription);
            clearInterval(pingInterval);
        };
    }, [cajaIp]);

    // ═══ PERSIST HELPER ═══
    const markProcessed = (key: string) => {
        processedIds.current.add(key);
        const arr = Array.from(processedIds.current);
        if (arr.length > 200) arr.splice(0, arr.length - 200);
        localStorage.setItem('pl_processed_ids', JSON.stringify(arr));
    };

    // ═══ PRE-CHECK PROCESSOR ═══
    const processPreCheck = async (order: any) => {
        const key = `precheck_${order.id}`;

        // Runtime lock (prevent parallel processing)
        if (processingNow.current.has(key)) return;
        processingNow.current.add(key);

        try {
            // 1. UPDATE DB IMMEDIATELY — closes the cycle for tablets
            await supabase.from('orders').update({
                print_status: 'printed',
                requires_printing: false
            }).eq('id', order.id);

            // 2. Mark local dedup cache
            markProcessed(key);

            // 3. Fetch full order data
            const { data: fullOrder } = await supabase
                .from('orders')
                .select('*, waiter:profiles!waiter_id(name), tables(section, number)')
                .eq('id', order.id)
                .single();
            if (!fullOrder) return;

            const { data: items } = await supabase.from('order_items').select('*, products(name)').eq('order_id', order.id);
            if (!items) return;

            // 4. Print via Electron IPC (silent, directly to Windows driver)
            await printService.printPreAccountTicket({
                orderId: fullOrder.id,
                orderNumber: fullOrder.order_number,
                tableNumber: fullOrder.tables?.number || 0,
                tableName: fullOrder.tables?.section || '---',
                waiterName: fullOrder.waiter?.name || '---',
                items: items.map((i: any) => ({
                    name: i.product_name || i.products?.name,
                    quantity: i.quantity,
                    price: i.unit_price,
                    notes: i.notes
                })),
                subtotal: fullOrder.subtotal || 0,
                createdAt: fullOrder.created_at,
                tipAmount: fullOrder.tip_amount || 0,
                total: (fullOrder.subtotal || 0) + (fullOrder.tip_amount || 0)
            });

            console.log('✅ Pre-cuenta impresa exitosamente:', order.id);
        } catch (e) {
            console.error('❌ Error printing pre-check:', e);
        } finally {
            processingNow.current.delete(key);
            // Allow reprint of the same order after 10 seconds
            setTimeout(() => {
                processedIds.current.delete(key);
                localStorage.setItem('print_processed_ids', JSON.stringify(Array.from(processedIds.current)));
            }, 10000);
        }
    };

    return null;
};
