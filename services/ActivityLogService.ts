import { supabase } from '../supabase';
import { ActivityLog, User } from '../types';
import { registrarAuditoria } from './auditService';

// ═══════════════════════════════════════════════════════════
// MÓDULOS DEL SISTEMA
// ═══════════════════════════════════════════════════════════
export type AuditModule =
    | 'SALA'
    | 'CAJA'
    | 'ADMIN'
    | 'INVENTARIO'
    | 'FACTURACION'
    | 'CONFIG'
    | 'MENU'
    | 'USUARIOS'
    | 'VENTAS'
    | 'SEGURIDAD'
    | 'CONTABILIDAD'
    | 'PRODUCCION';

// ═══════════════════════════════════════════════════════════
// EVENTOS TIPADOS POR MÓDULO
// ═══════════════════════════════════════════════════════════
export type AuditAction =
    // VENTAS / POS
    | 'ORDEN_CREADA'
    | 'ORDEN_MODIFICADA'
    | 'ORDEN_CERRADA'
    | 'ORDEN_ANULADA'
    | 'ORDEN_ENVIADA_COCINA'
    | 'ITEM_AGREGADO'
    | 'ITEM_ELIMINADO'
    | 'ITEM_MODIFICADO'
    | 'ITEM_ANULADO'
    | 'DESCUENTO_APLICADO'
    | 'DESCUENTO_GLOBAL'
    | 'TRASLADO_MESA'
    | 'DIVISION_CUENTA'
    | 'CAMBIO_MESERO'
    // FACTURACIÓN
    | 'FACTURA_EMITIDA'
    | 'FACTURA_ANULADA'
    | 'FACTURA_CONTINGENCIA'
    | 'FACTURA_ANTICIPADA'
    // CAJA
    | 'TURNO_ABIERTO'
    | 'CORTE_X'
    | 'CORTE_Z'
    | 'INGRESO_CAJA'
    | 'EGRESO_CAJA'
    | 'APERTURA_GAVETA'
    // INVENTARIO
    | 'COMPRA_REGISTRADA'
    | 'COMPRA_PROCESADA'
    | 'NIVELACION_INVENTARIO'
    | 'AJUSTE_STOCK'
    | 'TRANSFERENCIA_STOCK'
    // MENÚ / PRODUCTOS
    | 'PRODUCTO_CREADO'
    | 'PRODUCTO_MODIFICADO'
    | 'PRODUCTO_ELIMINADO'
    | 'PRECIO_MODIFICADO'
    | 'CATEGORIA_MODIFICADA'
    // USUARIOS / SEGURIDAD
    | 'USUARIO_CREADO'
    | 'USUARIO_MODIFICADO'
    | 'USUARIO_ELIMINADO'
    | 'LOGIN_EXITOSO'
    | 'LOGIN_FALLIDO'
    | 'PIN_AUTORIZADO'
    | 'PIN_RECHAZADO'
    | 'PERMISO_MODIFICADO'
    // GASTOS
    | 'GASTO_CREADO'
    | 'GASTO_MODIFICADO'
    | 'GASTO_ELIMINADO'
    | 'GASTO_APROBADO'
    // CONFIG
    | 'CONFIG_MODIFICADA'
    // ADMIN
    | 'ACCESO_ADMIN'
    // GENÉRICO (compatibilidad con logs existentes)
    | string;

// ═══════════════════════════════════════════════════════════
// SEVERIDAD DEL EVENTO
// ═══════════════════════════════════════════════════════════
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'FINANCIAL';

// ═══════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════

/** Detalle de cambio antes/después para un campo */
export interface FieldChange {
    field: string;
    label?: string;
    before: any;
    after: any;
}

/** Impacto financiero del evento */
export interface FinancialImpact {
    /** Monto total afectado */
    amount: number;
    /** Moneda (default GTQ) */
    currency?: string;
    /** Tipo de impacto */
    type: 'INGRESO' | 'EGRESO' | 'ANULACION' | 'DESCUENTO' | 'AJUSTE' | 'NEUTRO';
    /** IVA involucrado si aplica */
    tax_amount?: number;
    /** Propina involucrada si aplica */
    tip_amount?: number;
    /** Desglose de pago */
    payment_breakdown?: {
        efectivo?: number;
        tarjeta?: number;
        credito?: number;
        otros?: number;
    };
}

/** Parámetros enriquecidos para el log de auditoría */
export interface LogActionParams {
    user: User;
    module: AuditModule;
    action: AuditAction | string;
    /** Datos contextuales del evento */
    details?: Record<string, any>;
    /** Severidad del evento (default: INFO) */
    severity?: AuditSeverity;
    /** Lista de cambios campo por campo (antes/después) */
    changes?: FieldChange[];
    /** Impacto financiero si aplica */
    financial?: FinancialImpact;
    /** ID de la entidad principal afectada (orden, factura, producto, etc.) */
    entity_id?: string;
    /** Tipo de entidad (ORDER, INVOICE, PRODUCT, USER, etc.) */
    entity_type?: string;
    /** IP o identificador del dispositivo */
    device_info?: string;
    branchId?: string;
    orgId?: string;
}

export interface ActivityLogFilters {
    startDate?: string;
    endDate?: string;
    module?: string;
    role?: string;
    branchId?: string;
    search?: string;
    severity?: AuditSeverity;
    entity_id?: string;
    entity_type?: string;
}

// ═══════════════════════════════════════════════════════════
// SERVICIO PRINCIPAL
// ═══════════════════════════════════════════════════════════

class ActivityLogService {
    private queue: LogActionParams[] = [];
    private isProcessing = false;
    private readonly BATCH_INTERVAL = 2000; // ms

    constructor() {
        // Procesar cola cada 2 segundos para eventos no-críticos
        setInterval(() => this.processQueue(), this.BATCH_INTERVAL);

        // Flush al cerrar ventana
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.flushSync());
        }
    }

    /**
     * Registra una acción en el historial de auditoría.
     * Compatible al 100% con el API anterior (detalles simples)
     * pero ahora acepta campos enriquecidos opcionales.
     */
    async log(params: LogActionParams): Promise<{ success: boolean; error?: string }> {
        const {
            user, module, action,
            details = {},
            severity = 'INFO',
            changes,
            financial,
            entity_id,
            entity_type,
            device_info,
            branchId, orgId
        } = params;

        // Construir el objeto details enriquecido
        const enrichedDetails: Record<string, any> = {
            ...details,
        };

        // Agregar cambios antes/después si existen
        if (changes && changes.length > 0) {
            enrichedDetails._changes = changes.map(c => ({
                field: c.field,
                label: c.label || c.field,
                before: c.before,
                after: c.after
            }));
        }

        // Agregar impacto financiero si existe
        if (financial) {
            enrichedDetails._financial = {
                amount: financial.amount,
                currency: financial.currency || 'GTQ',
                type: financial.type,
                tax_amount: financial.tax_amount,
                tip_amount: financial.tip_amount,
                payment_breakdown: financial.payment_breakdown
            };
        }

        // Agregar metadata del evento
        enrichedDetails._meta = {
            severity,
            entity_id: entity_id || details?.orderId || details?.invoiceId || details?.productId,
            entity_type: entity_type || this.inferEntityType(module, action),
            device: device_info || this.getDeviceInfo(),
            timestamp_local: new Date().toISOString(),
            app_version: '2.0'
        };

        try {
            // --- REDIRECCIÓN AL NUEVO SISTEMA (VIGILANCIA TOTAL - INMUTABLE) ---
            let prevValues: Record<string, any> | undefined;
            let newValues: Record<string, any> = { ...enrichedDetails };
            
            if (changes && changes.length > 0) {
                prevValues = {};
                newValues = {};
                changes.forEach(c => {
                    prevValues![c.field] = c.before;
                    newValues[c.field] = c.after;
                });
            }

            const { success, error } = await registrarAuditoria({
                modulo: String(module) || 'SISTEMA',
                accion: String(action),
                accion_descripcion: details?.descripcion || `${action} registrado vía ActivityLogService`,
                entidad_id: String(enrichedDetails._meta.entity_id || ''),
                entidad_tipo: String(enrichedDetails._meta.entity_type || 'GENERAL').toLowerCase(),
                entidad_nombre: String(enrichedDetails._meta.entity_type || 'Entidad'),
                valores_anteriores: prevValues,
                valores_nuevos: newValues,
                metadata: enrichedDetails,
                impacto_financiero: financial ? {
                    monto_total: financial.amount,
                    diferencia_precio: financial.amount,
                    impacto_mensual_estimado: `Impacto ${financial.type}: Q${financial.amount}`
                } : undefined
            }, user ? { id: user.id, nombre: user.name, rol: user.role } : undefined);

            if (!success) {
                console.error('❌ Error logging activity:', error);
                this.saveToLocalFallback(params);
                return { success: false, error: error };
            }

            return { success: true };
        } catch (err: any) {
            console.error('❌ Critical error in ActivityLogService:', err);
            this.saveToLocalFallback(params);
            return { success: false, error: err.message };
        }
    }

    /**
     * Log con tracking de cambios automático (before/after).
     * Ideal para actualizaciones de entidades.
     */
    async logWithDiff(
        params: Omit<LogActionParams, 'changes'>,
        before: Record<string, any>,
        after: Record<string, any>,
        trackedFields: string[]
    ): Promise<{ success: boolean; error?: string }> {
        const changes: FieldChange[] = [];

        for (const field of trackedFields) {
            const oldVal = before[field];
            const newVal = after[field];

            // Solo registrar si cambió
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changes.push({
                    field,
                    before: oldVal ?? null,
                    after: newVal ?? null
                });
            }
        }

        // Si no hubo cambios reales, no loguear
        if (changes.length === 0) return { success: true };

        return this.log({
            ...params,
            changes,
            details: {
                ...params.details,
                fields_changed: changes.map(c => c.field),
                changes_count: changes.length
            }
        });
    }

    /**
     * Log de evento con impacto financiero.
     * Calcula automáticamente el tipo de impacto.
     */
    async logFinancial(
        params: Omit<LogActionParams, 'financial'>,
        impact: FinancialImpact
    ): Promise<{ success: boolean; error?: string }> {
        return this.log({
            ...params,
            financial: impact,
            severity: params.severity || 'FINANCIAL'
        });
    }

    /**
     * Log de evento de seguridad (login fallido, acceso no autorizado, etc.)
     */
    async logSecurity(
        params: Omit<LogActionParams, 'severity' | 'module'>
    ): Promise<{ success: boolean; error?: string }> {
        return this.log({
            ...params,
            module: 'SEGURIDAD',
            severity: 'CRITICAL'
        });
    }

    /**
     * Encolar un log para procesamiento batch (eventos de baja prioridad)
     */
    enqueue(params: LogActionParams): void {
        this.queue.push(params);
    }

    /**
     * Obtiene los logs de actividad con filtros aplicados
     */
    async getLogs(filters: ActivityLogFilters): Promise<ActivityLog[]> {
        let query = supabase
            .from('activity_log')
            .select('*')
            .order('fecha_hora', { ascending: false });

        if (filters.startDate) {
            query = query.gte('fecha_hora', `${filters.startDate}T00:00:00`);
        }
        if (filters.endDate) {
            query = query.lte('fecha_hora', `${filters.endDate}T23:59:59`);
        }
        if (filters.module && filters.module !== 'ALL') {
            query = query.eq('modulo', filters.module);
        }
        if (filters.role && filters.role !== 'ALL') {
            query = query.eq('usuario_rol', filters.role);
        }
        if (filters.search) {
            query = query.or(`usuario_nombre.ilike.%${filters.search}%,accion.ilike.%${filters.search}%`);
        }

        const { data, error } = await query.limit(500);

        if (error) {
            console.error('Error fetching logs:', error);
            return [];
        }

        return (data || []).map((row: any) => {
            const atributos = row.atributos || {};
            const cambios = atributos.cambios || {};
            
            // Reconstruir lista de cambios para el UI
            const uiChanges = [];
            if (cambios.anteriores && cambios.nuevos) {
                for (const k in cambios.nuevos) {
                    uiChanges.push({
                        field: k,
                        before: cambios.anteriores[k],
                        after: cambios.nuevos[k]
                    });
                }
            }

            return {
                id: row.id,
                user_name: row.usuario_nombre,
                user_role: row.usuario_rol,
                module: row.modulo,
                action: row.accion,
                created_at: row.fecha_hora,
                details: {
                    ...atributos,
                    _changes: uiChanges,
                    _financial: row.es_financiero ? {
                        amount: row.impacto_monto,
                        type: row.impacto_tipo,
                        notes: atributos.descripcion
                    } : undefined,
                    _meta: {
                        severity: atributos.metadata?.severity || (row.es_financiero ? 'FINANCIAL' : 'INFO')
                    }
                }
            } as any;
        });
    }

    /**
     * Sincronizar logs guardados localmente (fallback offline)
     */
    async syncLocalLogs(): Promise<number> {
        const key = 'activity_logs_fallback';
        const raw = localStorage.getItem(key);
        if (!raw) return 0;

        try {
            const pendingLogs: any[] = JSON.parse(raw);
            let synced = 0;

            for (const log of pendingLogs) {
                const { error } = await supabase.from('activity_log').insert(log);
                if (!error) synced++;
            }

            if (synced === pendingLogs.length) {
                localStorage.removeItem(key);
            } else {
                // Conservar los que fallaron
                const remaining = pendingLogs.slice(synced);
                localStorage.setItem(key, JSON.stringify(remaining));
            }

            console.log(`✅ Synced ${synced}/${pendingLogs.length} offline logs`);
            return synced;
        } catch (e) {
            console.error('Error syncing local logs:', e);
            return 0;
        }
    }

    // ───────────────────────────────────────────────────
    // MÉTODOS PRIVADOS
    // ───────────────────────────────────────────────────

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const batch = this.queue.splice(0, 10); // Máximo 10 por ciclo
        for (const params of batch) {
            await this.log(params);
        }

        this.isProcessing = false;
    }

    private flushSync(): void {
        if (this.queue.length === 0) return;
        // Guardar cola pendiente en localStorage
        const key = 'activity_logs_queue';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const toSave = [...existing, ...this.queue.map(p => ({
            user_id: p.user.id,
            user_name: p.user.name,
            user_role: p.user.role,
            module: p.module,
            action: p.action,
            details: p.details,
            branch_id: p.branchId || p.user.branch_id,
            org_id: p.orgId || p.user.org_id
        }))];
        localStorage.setItem(key, JSON.stringify(toSave));
        this.queue = [];
    }

    private saveToLocalFallback(params: LogActionParams): void {
        try {
            const key = 'activity_logs_fallback';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push({
                user_id: params.user.id,
                user_name: params.user.name,
                user_role: params.user.role,
                module: params.module,
                action: params.action,
                details: params.details,
                branch_id: params.branchId || params.user.branch_id,
                org_id: params.orgId || params.user.org_id,
                _offline_at: new Date().toISOString()
            });
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {
            console.error('Failed to save fallback log:', e);
        }
    }

    private inferEntityType(module: AuditModule, action: string): string {
        if (action.startsWith('ORDEN') || action.startsWith('ITEM')) return 'ORDER';
        if (action.startsWith('FACTURA')) return 'INVOICE';
        if (action.startsWith('PRODUCTO') || action.startsWith('PRECIO')) return 'PRODUCT';
        if (action.startsWith('USUARIO') || action.startsWith('LOGIN') || action.startsWith('PIN')) return 'USER';
        if (action.startsWith('CORTE') || action.startsWith('TURNO')) return 'SHIFT';
        if (action.startsWith('GASTO')) return 'EXPENSE';
        if (action.startsWith('COMPRA')) return 'PURCHASE';
        if (module === 'CONFIG') return 'CONFIG';
        return 'SYSTEM';
    }

    private getDeviceInfo(): string {
        if (typeof window === 'undefined') return 'server';
        const isElectron = !!((window as any).electronAPI || (window as any).electron);
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        const isTablet = /iPad|Tablet/i.test(navigator.userAgent);
        if (isElectron) return 'electron-desktop';
        if (isTablet) return 'tablet-web';
        if (isMobile) return 'mobile-web';
        return 'desktop-web';
    }
}

export const activityLogService = new ActivityLogService();
