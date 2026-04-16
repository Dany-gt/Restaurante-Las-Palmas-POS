
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { offlineDB, OfflineRecord } from '../services/OfflineDB';

export const useOfflineSync = () => {
    const [pendingCount, setPendingCount] = useState(0);

    const updatePendingCount = async () => {
        const count = await offlineDB.getPendingCount();
        setPendingCount(count);
        // Custom event for App.tsx to listen to
        window.dispatchEvent(new CustomEvent('offline-sync-count', { detail: count }));
    };

    const syncRecords = async () => {
        if (!navigator.onLine) return;

        const pending = await offlineDB.getPendingRecords();
        if (pending.length === 0) {
            updatePendingCount();
            return;
        }

        console.log(`🔄 Attempting to sync ${pending.length} offline records...`);

        for (const record of pending) {
            try {
                let success = false;

                if (record.type === 'ORDER') {
                    success = await processOrderSync(record);
                } else if (record.type === 'EXPENSE') {
                    success = await processExpenseSync(record);
                } else if (record.type === 'CASH_INIT') {
                    success = await processCashInitSync(record);
                } else if (record.type === 'CREDIT_PAYMENT') {
                    success = await processCreditPaymentSync(record);
                } else if (record.type === 'CASH_CLOSE') {
                    success = await processCashCloseSync(record);
                }

                if (success) {
                    await offlineDB.markAsSynced(record.id);
                    console.log(`✅ Record ${record.id} (${record.type}) synced and removed.`);
                } else {
                    await offlineDB.incrementRetry(record.id);
                }
            } catch (err) {
                console.error(`❌ Error syncing record ${record.id}:`, err);
                await offlineDB.incrementRetry(record.id);
            }
        }

        updatePendingCount();
    };

    const processOrderSync = async (record: OfflineRecord) => {
        const { data } = record;
        // Use client-side generated UUID (record.id) as the primary key if it's a new order
        // In Supabase, if we insert with an ID, it uses that ID.

        try {
            // 1. Sync Order
            const { error: orderError } = await supabase.from('orders').upsert({
                id: record.id,
                ...data.order,
                status: data.order.status || 'pending',
                synced_at: new Date().toISOString()
            });

            if (orderError) throw orderError;

            // 2. Sync Items
            if (data.items && data.items.length > 0) {
                const { error: itemsError } = await supabase.from('order_items').upsert(
                    data.items.map((item: any) => ({
                        order_id: record.id,
                        ...item
                    }))
                );
                if (itemsError) throw itemsError;
            }

            // 3. Sync Invoice if present
            if (data.invoice) {
                const { error: invError } = await supabase.from('invoices').upsert({
                    order_id: record.id,
                    ...data.invoice
                });
                if (invError) throw invError;
            }

            return true;
        } catch (e) {
            console.error("Order sync error details:", e);
            return false;
        }
    };

    const processExpenseSync = async (record: OfflineRecord) => {
        try {
            const { error } = await supabase.from('expenses').upsert({
                id: record.id,
                ...record.data
            });
            return !error;
        } catch (e) {
            return false;
        }
    };

    const processCashInitSync = async (record: OfflineRecord) => {
        try {
            const { error: shiftError } = await supabase.from('shifts').upsert({
                id: record.id,
                ...record.data
            });
            if (shiftError) throw shiftError;

            // Also update the register
            const { error: regError } = await supabase.from('cash_registers').update({
                status: 'open',
                current_balance: record.data.start_amount
            }).eq('id', record.data.cash_register_id);

            return !regError;
        } catch (e) {
            return false;
        }
    };

    const processCreditPaymentSync = async (record: OfflineRecord) => {
        try {
            const { data, error } = await supabase.rpc('register_credit_payment', {
                p_customer_id: record.data.customer_id,
                p_amount: record.data.amount,
                p_payment_method: record.data.payment_method,
                p_description: record.data.description,
                p_created_by: record.data.created_by
            });
            if (error) throw error;
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return result.success;
        } catch (e) {
            return false;
        }
    };

    const processCashCloseSync = async (record: OfflineRecord) => {
        try {
            const { error: shiftError } = await supabase.from('shifts').update({
                status: 'CLOSED',
                ...record.data.closingData
            }).eq('id', record.id);

            if (shiftError) throw shiftError;

            if (record.data.cashRegisterId) {
                await supabase.from('cash_registers').update({
                    status: 'closed',
                    last_closure_at: record.data.closingData.end_time,
                    current_balance: record.data.closingData.counted_amount
                }).eq('id', record.data.cashRegisterId);
            }

            return true;
        } catch (e) {
            return false;
        }
    };

    useEffect(() => {
        updatePendingCount();

        // Listen for online events to trigger sync
        window.addEventListener('online', syncRecords);
        window.addEventListener('offline-sync-trigger', syncRecords);

        const interval = setInterval(() => {
            if (navigator.onLine) syncRecords();
            else updatePendingCount();
        }, 30000); // Check every 30s

        return () => {
            window.removeEventListener('online', syncRecords);
            window.removeEventListener('offline-sync-trigger', syncRecords);
            clearInterval(interval);
        };
    }, []);

    return { pendingCount, syncRecords };
};
