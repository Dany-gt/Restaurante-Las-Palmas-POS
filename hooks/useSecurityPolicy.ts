import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { activityLogService } from '../services/ActivityLogService';

interface SecuritySettings {
    limit_order_access: boolean;
    require_pin_for_register: boolean;
    multi_cashier_register: boolean;
    allow_close_with_open_orders: boolean;
    allow_close_with_cashier_orders: boolean;
}

interface UseSecurityPolicyReturn {
    settings: SecuritySettings | null;
    canAccessOrder: (orderId: string, currentUserId: string) => Promise<boolean>;
    validatePin: (pin: string, expectedRole?: string) => Promise<{ valid: boolean; user?: any }>;
    canCloseCashRegister: () => Promise<{ allowed: boolean; reason?: string }>;
}

export const useSecurityPolicy = (systemSettings?: any): UseSecurityPolicyReturn => {
    const settings: SecuritySettings | null = systemSettings ? {
        limit_order_access: systemSettings.limit_order_access ?? true,
        require_pin_for_register: systemSettings.require_pin_for_register ?? true,
        multi_cashier_register: systemSettings.multi_cashier_register ?? false,
        allow_close_with_open_orders: systemSettings.allow_close_with_open_orders ?? false,
        allow_close_with_cashier_orders: systemSettings.allow_close_with_cashier_orders ?? true,
    } : null;

    const canAccessOrder = useCallback(async (orderId: string, currentUserId: string): Promise<boolean> => {
        // If setting is disabled, allow access to everyone
        if (!settings?.limit_order_access) return true;

        try {
            const { data: order } = await supabase
                .from('orders')
                .select('waiter_id')
                .eq('id', orderId)
                .single();

            if (!order) return false;

            // Allow if user is the creator or if they're an admin
            return order.waiter_id === currentUserId;
        } catch {
            return false;
        }
    }, [settings]);

    const validatePin = useCallback(async (pin: string, expectedRole?: string): Promise<{ valid: boolean; user?: any }> => {
        try {
            // 1. Fetch user by PIN only
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('pin', pin)
                .single();

            if (error || !data) {
                // LOG: PIN Incorrecto o inexistente
                await activityLogService.log({
                    user: { id: 'SYSTEM', name: 'Intento Anónimo', role: 'UNKNOWN' } as any,
                    module: 'CONFIG',
                    action: 'Intento de PIN Fallido',
                    details: { reason: 'PIN no encontrado o inválido', expectedRole }
                });
                return { valid: false };
            }

            // 2. MASTER/ADMIN BYPASS
            if (data.role === 'MASTER' || data.role === 'SOPORTE' || data.role === 'ADMIN') {
                await activityLogService.log({
                    user: data,
                    module: 'CONFIG',
                    action: 'Validación de PIN Exitosa (Bypass Admin)',
                    details: { role: data.role, target: expectedRole }
                });
                return { valid: true, user: data };
            }

            // 3. Normal Role Check
            if (expectedRole && data.role !== expectedRole) {
                await activityLogService.log({
                    user: data,
                    module: 'CONFIG',
                    action: 'Validación de PIN Fallida (Rol insuficiente)',
                    details: { 
                        userRole: data.role, 
                        requiredRole: expectedRole,
                        userName: data.name 
                    }
                });
                return { valid: false };
            }

            await activityLogService.log({
                user: data,
                module: 'CONFIG',
                action: 'Validación de PIN Exitosa',
                details: { role: data.role }
            });

            return { valid: true, user: data };
        } catch (err: any) {
            return { valid: false };
        }
    }, []);

    const canCloseCashRegister = useCallback(async (): Promise<{ allowed: boolean; reason?: string }> => {
        try {
            // Check for open orders
            const { data: openOrders } = await supabase
                .from('orders')
                .select('id, status')
                .in('status', ['pending', 'preparing', 'ready']);

            const hasOpenOrders = openOrders && openOrders.length > 0;

            if (hasOpenOrders && !settings?.allow_close_with_open_orders) {
                return {
                    allowed: false,
                    reason: `Hay ${openOrders.length} orden(es) abiertas. Ciérrelas antes de cerrar caja.`
                };
            }

            return { allowed: true };
        } catch {
            return { allowed: true };
        }
    }, [settings]);

    return {
        settings,
        canAccessOrder,
        validatePin,
        canCloseCashRegister
    };
};
