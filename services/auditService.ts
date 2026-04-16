import { supabase } from '../supabase';

// ── TIPOS ──────────────────────────────────────────────
export type AuditAction = 
  | 'ORDEN_CREADA' | 'ORDEN_MODIFICADA' | 'ORDEN_CERRADA'
  | 'ORDEN_ANULADA' | 'DESCUENTO_APLICADO'
  | 'FACTURA_EMITIDA' | 'FACTURA_ANULADA' | 'CORTE_CAJA'
  | 'PLATILLO_CREADO' | 'PLATILLO_MODIFICADO'
  | 'PLATILLO_ELIMINADO' | 'PRECIO_CAMBIADO'
  | 'DISPONIBILIDAD_CAMBIADA'
  | 'FICHA_TECNICA_GUARDADA' | 'CONFIG_MOD_CAMBIADA'
  | 'GASTOS_FIJOS_MODIFICADOS'
  | 'FACTURA_COMPRA_REGISTRADA' | 'DECLARACION_GENERADA'
  | 'CONCILIACION_APROBADA' | 'ASIENTO_CREADO'
  | 'STOCK_AJUSTADO' | 'ITEM_CREADO' | 'ITEM_BAJA'
  | 'CONTEO_FISICO' | 'EMPLEADO_INGRESADO'
  | 'SALARIO_MODIFICADO' | 'PLANILLA_PROCESADA'
  | 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO' | 'LOGOUT'
  | 'USUARIO_CREADO' | 'ROL_MODIFICADO'
  | 'CONFIG_MODIFICADA' | 'ACCESO_DENEGADO'
  // Compatibilidad
  | string;

export interface AuditEvent {
  modulo: string;
  sub_modulo?: string;
  accion: AuditAction;
  accion_descripcion: string;
  entidad_tipo?: string;
  entidad_id?: string;
  entidad_nombre?: string;
  valores_anteriores?: Record<string, any>;
  valores_nuevos?: Record<string, any>;
  campos_modificados?: string[];
  impacto_financiero?: {
    diferencia_precio?: number;
    diferencia_margen?: number;
    impacto_mensual_estimado?: string;
    afecta_punto_equilibrio?: boolean;
    monto_total?: number;
  };
  es_reversible?: boolean;
  datos_para_revertir?: Record<string, any>;
  metadata?: Record<string, any>;
}

// ── HELPERS ──────────────────────────────────────────────
const getDeviceInfo = () => {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Desktop Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Desktop / Mobile Safari';
    if (ua.includes('Firefox')) return 'Desktop Firefox';
    return ua.substring(0, 50);
}

const getSessionId = () => {
    let sid = localStorage.getItem('audit_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('audit_session_id', sid);
    }
    return sid;
}

const formatLocalTimestamp = (date: Date) => {
    return date.toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
}

// ── FUNCIÓN PRINCIPAL ──────────────────────────────────
export const registrarAuditoria = async (
  evento: AuditEvent,
  usuario?: { id: string; nombre: string; rol: string }
) => {
  try {
    let user = usuario;
    if (!user) {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            user = JSON.parse(stored);
        }
    }
    
    const deviceInfo = getDeviceInfo()
    
    // Obtener IP (opcional/mock si está en cliente)
    let ip = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
    } catch(e) {}
    
    const registro = {
      org_id: 'default',
      usuario_id: user?.id || 'sistema',
      usuario_nombre: user?.nombre || 'Sistema',
      usuario_rol: user?.rol || 'SISTEMA',
      usuario_ip: ip,
      usuario_dispositivo: deviceInfo,
      usuario_url_actual: window.location.pathname,
      sesion_id: getSessionId(),
      modulo: evento.modulo,
      sub_modulo: evento.sub_modulo,
      accion: evento.accion,
      accion_descripcion: evento.accion_descripcion,
      entidad_tipo: evento.entidad_tipo,
      entidad_id: evento.entidad_id,
      entidad_nombre: evento.entidad_nombre,
      valores_anteriores: evento.valores_anteriores,
      valores_nuevos: evento.valores_nuevos,
      campos_modificados: evento.campos_modificados,
      impacto_financiero: evento.impacto_financiero,
      es_reversible: evento.es_reversible || false,
      datos_para_revertir: evento.datos_para_revertir,
      metadata: evento.metadata,
      timestamp: new Date().toISOString(),
      timestamp_local: formatLocalTimestamp(new Date())
    };
    
    const { error } = await supabase
      .from('activity_log_detailed')
      .insert(registro);
    
    if (error) {
      console.error('Audit log error:', error);
      // Fallback
      const prev = JSON.parse(localStorage.getItem('audit_fallback') || '[]');
      prev.push(registro);
      localStorage.setItem('audit_fallback', JSON.stringify(prev));
    }
    
    return { success: !error };
  } catch (err) {
    console.error('Audit service error:', err);
    return { success: false };
  }
}

// ── HELPER — DETECTAR CAMBIOS AUTOMÁTICO ───────────────
export const detectarCambios = (
  objetoAnterior: Record<string, any>,
  objetoNuevo: Record<string, any>
): {
  campos_modificados: string[]
  valores_anteriores: Record<string, any>
  valores_nuevos: Record<string, any>
} => {
  const campos_modificados: string[] = []
  const valores_anteriores: Record<string, any> = {}
  const valores_nuevos: Record<string, any> = {}
  
  if (!objetoAnterior || !objetoNuevo) return { campos_modificados, valores_anteriores, valores_nuevos };

  Object.keys(objetoNuevo).forEach(campo => {
    // Si anterior es undefined pero nuevo tiene valor, o si son diferentes
    if (JSON.stringify(objetoAnterior[campo]) !== JSON.stringify(objetoNuevo[campo])) {
      campos_modificados.push(campo)
      valores_anteriores[campo] = objetoAnterior[campo]
      valores_nuevos[campo] = objetoNuevo[campo]
    }
  });

  // Chequear campos borrados
  Object.keys(objetoAnterior).forEach(campo => {
    if (objetoNuevo[campo] === undefined) {
        if (!campos_modificados.includes(campo)) campos_modificados.push(campo);
        valores_anteriores[campo] = objetoAnterior[campo];
        valores_nuevos[campo] = null;
    }
  });
  
  return { campos_modificados, valores_anteriores, valores_nuevos }
}
