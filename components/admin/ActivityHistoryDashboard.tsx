import React, { useState, useEffect } from 'react';
import { 
    Search, Calendar, Filter, User, Box, 
    FileText, ChevronDown, ChevronRight, 
    RefreshCcw, Download, Info, Shield, 
    Layout, Receipt, Trash, Edit3, Settings,
    Printer, X, Eye, FileSearch
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { activityLogService } from '../../services/ActivityLogService';
import { ActivityLog } from '../../types';
import dayjs from 'dayjs';

const IGNORED_KEYS = ['userAgent', 'timestamp', 'created_at', 'updated_at', 'id', '_meta', '_changes', '_financial'];

const KEY_LABELS: Record<string, string> = {
    // Identificadores
    orderId: 'No. Orden',
    orderNumber: 'No. Orden',
    orderIds: 'Órdenes',
    numero_orden: 'No. Orden',
    shiftId: 'ID Turno',
    caja_id: 'ID Caja',
    productId: 'ID Producto',
    branchId: 'Sucursal ID',
    branch_id: 'Sucursal ID',
    registerId: 'Caja ID',
    targetTableId: 'Mesa Destino ID',
    // Montos y financieros
    amount: 'Monto',
    total: 'Total',
    total_final: 'Total Final',
    total_facturado: 'Total Facturado',
    total_orden: 'Total Orden',
    total_estimado: 'Total Estimado',
    total_anulado: 'Total Anulado',
    subtotal: 'Subtotal',
    subtotal_item: 'Subtotal Ítem',
    subtotal_antes_descuento: 'Subtotal (Antes)',
    subtotal_despues_descuento: 'Subtotal (Después)',
    impuesto: 'IVA',
    iva_generado: 'IVA Generado',
    propina: 'Propina',
    propina_actual: 'Propina Actual',
    propina_estimada: 'Propina Estimada',
    propina_metodo: 'Vía Propina',
    descuento_total: 'Descuento Total',
    descuento_monto: 'Monto Descuento',
    monto_descontado: 'Monto Descontado',
    monto_anulado: 'Monto Anulado',
    precio_unitario: 'Precio Unit.',
    price_unitario: 'Precio Unit.',
    // Descuentos
    descuento_tipo: 'Tipo Descuento',
    descuento_valor: 'Valor Descuento',
    descuento_nombre: 'Nombre Descuento',
    descuento_aplicado: 'Descuento Aplicado',
    motivo: 'Motivo',
    motivo_anulacion: 'Motivo Anulación',
    // Facturación
    factura_serie: 'Serie Factura',
    factura_numero: 'No. Factura',
    factura_uuid: 'UUID DTE',
    fecha_certificacion: 'Certificación',
    factura_preexistente: 'Factura Previa',
    es_contingencia: 'Modo Contingencia',
    es_por_consumo: 'Por Consumo',
    cliente_nit: 'NIT Cliente',
    cliente_nombre: 'Nombre Cliente',
    // Pagos
    forma_pago: 'Forma de Pago',
    forma_pago_principal: 'Pago Principal',
    procesador_tarjeta: 'Procesador',
    pagos: 'Desglose de Pagos',
    // Mesa y ubicación
    mesa: 'Mesa',
    seccion: 'Sección',
    mesa_origen: 'Mesa Origen',
    mesa_destino: 'Mesa Destino',
    // Personal
    mesero: 'Mesero',
    cajero: 'Cajero',
    mesero_original: 'Mesero Original',
    mesero_anterior_id: 'ID Mesero Anterior',
    mesero_anterior_nombre: 'Mesero Anterior',
    mesero_nuevo_id: 'ID Mesero Nuevo',
    autorizado_por: 'Autorizado Por',
    autorizado_por_id: 'ID Autorizador',
    waiterName: 'Mesero',
    newWaiterId: 'Nuevo Mesero ID',
    // Items
    productName: 'Producto',
    cantidad: 'Cantidad',
    quantity: 'Cantidad',
    items_count: 'Cant. Productos',
    items_nuevos: 'Items Nuevos',
    items_total: 'Items Total',
    items_movidos: 'Items Movidos',
    items_anulados: 'Items Anulados',
    ordenes_cerradas: 'Órdenes Cerradas',
    ordenes_afectadas: 'Órdenes Afectadas',
    items: 'Detalle de Items',
    // Tipo de orden
    tipo_orden: 'Tipo Orden',
    // Caja / Turnos
    efectivo_contado: 'Efectivo Contado',
    efectivo_esperado: 'Efectivo Esperado',
    diferencia: 'Diferencia',
    diferencia_absoluta: 'Diferencia Abs.',
    cuadrado: 'Cuadrado',
    denominaciones: 'Denominaciones',
    notas_cierre: 'Notas de Cierre',
    hora_apertura: 'Hora Apertura',
    hora_cierre: 'Hora Cierre',
    monto_apertura: 'Monto Apertura',
    ventas_efectivo: 'Ventas Efectivo',
    ventas_tarjeta: 'Ventas Tarjeta',
    gastos_registrados: 'Gastos Registrados',
    // División de cuenta
    cuenta_destino: 'Cuenta Destino',
    orden_destino_id: 'Orden Destino',
    orden_origen_id: 'Orden Origen',
    // Campos legacy
    tableName: 'Mesa',
    tableNumber: 'Mesa No.',
    fromTable: 'Desde Mesa',
    toTableNumber: 'A Mesa No.',
    fromSection: 'Sección Origen',
    paymentMethod: 'Método de Pago',
    cardProcessor: 'Procesador Tarjeta',
    invoiceNumber: 'No. Factura',
    isContingency: 'Modo Contingencia',
    price: 'Precio',
    notes: 'Notas/Modificadores',
    description: 'Descripción',
    category: 'Categoría',
    startAmount: 'Monto Inicial',
    details: 'Detalles Adicionales',
    userName: 'Nombre Usuario',
    role: 'Rol',
    toAccountName: 'A Nombre de',
    toOrderId: 'Orden Destino ID',
    reason: 'Motivo',
    discount: 'Descuento',
    fields_changed: 'Campos Modificados',
    changes_count: 'Cambios Realizados',
    // Nuevos campos de auditoría detallada (Base)
    name: 'Nombre',
    categories: 'Categorías',
    is_available: 'Disponible',
    kitchen_stations: 'Estaciones de Cocina',
    inventory_item_id: 'ID Artículo Inventario',
    created_at: 'Fecha Creación',
    updated_at: 'Fecha Actualización',
    // --- Finanzas y Contabilidad ---
    banco: 'Banco',
    periodo: 'Periodo',
    movimientos_conciliados: 'Movimientos',
    monto_total_conciliado: 'Monto Conciliado',
    fecha_aprobacion: 'Aprobado el',
    nit_proveedor: 'NIT Proveedor',
    nombre_proveedor: 'Proveedor',
    num_factura: 'Factura No.',
    monto_total: 'Monto Total',
    iva_credito: 'IVA Crédito',
    categoria_contable: 'Categoría',
    cuenta_asignada: 'Cuenta',
    debito_fiscal: 'Débito Fiscal',
    credito_fiscal: 'Crédito Fiscal',
    neonet_acreditado: 'Neonet Ret.',
    iva_a_pagar: 'IVA Final',
    fecha_limite: 'Vencimiento',
    tipo: 'Tipo',
    monto_pagado: 'Pagado',
    fecha_pago: 'Fecha de Pago',
    referencia_pago: 'Referencia',
    cantidad_asientos: 'Asientos Generados',
    generacion_automatica: 'Proceso Automático',
    fecha: 'Fecha',
    concepto: 'Concepto',
    monto: 'Monto',
    // --- Seguridad ---
    modalTitle: 'Título',
    modalSubtitle: 'Mensaje',
    requiredRole: 'Rol Requerido',
    error: 'Error'
};

export const ActivityHistoryDashboard: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        module: 'ALL',
        role: 'ALL',
        search: ''
    });
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        const data = await activityLogService.getLogs(filters);
        setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [filters.startDate, filters.endDate, filters.module, filters.role]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs();
    };

    const handlePrint = () => {
        window.print();
    };

    const getModuleIcon = (module: string) => {
        switch (module) {
            case 'SALA': return <Layout size={14} />;
            case 'CAJA': return <Receipt size={14} />;
            case 'ADMIN': return <Shield size={14} />;
            case 'INVENTARIO': return <Box size={14} />;
            case 'FACTURACION': return <FileText size={14} />;
            case 'CONFIG': return <Settings size={14} />;
            default: return <Info size={14} />;
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'CAJERO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'MESERO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const formatValue = (key: string, value: any) => {
        if (value === null || value === undefined) return '--';
        if (typeof value === 'boolean') {
            return (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${value ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {value ? 'SÍ' : 'NO' }
                </span>
            );
        }

        // Arrays: items, pagos, orderIds, etc.
        if (Array.isArray(value)) {
            if (value.length === 0) return <span className="text-gray-400 text-[9px]">Vacío</span>;
            // Simple string/number arrays
            if (typeof value[0] === 'string' || typeof value[0] === 'number') {
                return <span className="font-bold text-gray-700 text-[10px] uppercase">{value.join(', ')}</span>;
            }
            // Complex object arrays (items, pagos)
            return (
                <div className="flex flex-col gap-0.5 text-[9px]">
                    {value.slice(0, 8).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 px-1.5 py-0.5 border border-gray-100 rounded-sm">
                            {item.nombre && <span className="font-bold text-gray-700 uppercase truncate max-w-[120px]">{item.nombre}</span>}
                            {item.metodo && <span className="font-bold text-blue-600 uppercase">{item.metodo}</span>}
                            {item.cantidad && <span className="text-gray-500">x{item.cantidad}</span>}
                            {item.monto !== undefined && <span className="font-black text-gray-900 ml-auto">Q{Number(item.monto).toFixed(2)}</span>}
                            {item.precio !== undefined && <span className="font-black text-gray-900 ml-auto">Q{Number(item.precio).toFixed(2)}</span>}
                            {item.procesador && <span className="text-gray-400 text-[8px]">({item.procesador})</span>}
                        </div>
                    ))}
                    {value.length > 8 && <span className="text-gray-400 text-[8px]">+{value.length - 8} más...</span>}
                </div>
            );
        }

        // Nested objects (mesa_origen, mesa_destino, denominaciones)
        if (typeof value === 'object') {
            // Mesa object
            if (value.numero !== undefined && value.seccion !== undefined) {
                return <span className="font-black text-gray-700 uppercase text-[10px]">{value.seccion} #{value.numero}</span>;
            }
            // Generic object -> Compact key:value render
            const entries = Object.entries(value).filter(([k]) => !IGNORED_KEYS.includes(k));
            if (entries.length <= 4) {
                return (
                    <div className="flex flex-col gap-0.5 text-[9px]">
                        {entries.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                                <span className="text-gray-400 uppercase">{KEY_LABELS[k] || k}:</span>
                                <span className="font-bold text-gray-700">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                );
            }
            return <span className="text-gray-400 text-[9px] font-mono">{JSON.stringify(value).slice(0, 80)}...</span>;
        }
        
        // Currency formatting for amounts
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('amount') || lowerKey.includes('total') || lowerKey.includes('price') || lowerKey.includes('subtotal') || lowerKey.includes('discount') || lowerKey.includes('monto') || lowerKey.includes('impuesto') || lowerKey.includes('iva') || lowerKey.includes('propina') || lowerKey.includes('efectivo') || lowerKey.includes('tarjeta') || lowerKey.includes('gasto') || lowerKey.includes('apertura') || lowerKey.includes('diferencia')) {
            if (!isNaN(value)) {
                const num = Number(value);
                const isNegative = num < 0;
                return <span className={`font-black ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>Q{Math.abs(num).toFixed(2)}{isNegative ? ' (-)' : ''}</span>;
            }
        }

        return <span className="font-bold text-gray-700 uppercase">{String(value)}</span>;
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] font-sans">
            {/* Header */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-4 shrink-0 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-black text-[#106ebe] tracking-tight flex items-center gap-2">
                            <Shield className="text-[#106ebe]" size={20} />
                            HISTORIAL DE ACTIVIDAD
                        </h1>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                            Auditoría integral de movimientos del sistema
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={fetchLogs}
                            className="h-8 w-8 flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 transition-all border border-gray-300 shadow-sm"
                            title="Recargar"
                        >
                            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button 
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 h-8 px-4 bg-[#106ebe] hover:bg-[#0d599a] text-white font-black text-[10px] uppercase shadow-sm transition-all active:scale-95"
                        >
                            <Eye size={14} />
                            VISTA PREVIA
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 bg-gray-200/50 px-2 py-1 rounded-sm border border-gray-300">
                        <div className="flex items-center gap-2 px-2 h-7 bg-white border border-gray-300">
                            <Calendar size={12} className="text-gray-400" />
                            <input 
                                type="date" 
                                value={filters.startDate}
                                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                                className="text-[10px] font-black text-gray-700 focus:outline-none bg-transparent"
                            />
                        </div>
                        <span className="text-[9px] font-black text-gray-400 uppercase px-1">Hasta</span>
                        <div className="flex items-center gap-2 px-2 h-7 bg-white border border-gray-300">
                            <Calendar size={12} className="text-gray-400" />
                            <input 
                                type="date" 
                                value={filters.endDate}
                                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                                className="text-[10px] font-black text-gray-700 focus:outline-none bg-transparent"
                            />
                        </div>
                    </div>

                    {/* Module Filter */}
                    <div className="flex items-center gap-2 bg-white px-2 h-7 border border-gray-300">
                        <Filter size={12} className="text-gray-400" />
                        <select 
                            value={filters.module}
                            onChange={(e) => setFilters({...filters, module: e.target.value})}
                            className="bg-transparent text-[10px] font-black text-gray-700 focus:outline-none uppercase"
                        >
                            <option value="ALL">TODOS LOS MÓDULOS</option>
                            <option value="VENTAS">VENTAS</option>
                            <option value="SALA">SALA</option>
                            <option value="CAJA">CAJA</option>
                            <option value="FACTURACION">FACTURACIÓN</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="INVENTARIO">INVENTARIO</option>
                            <option value="SEGURIDAD">SEGURIDAD</option>
                            <option value="MENU">MENÚ/PRODUCTOS</option>
                            <option value="USUARIOS">USUARIOS</option>
                            <option value="CONFIG">CONFIGURACIÓN</option>
                        </select>
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2 bg-white px-2 h-7 border border-gray-300">
                        <User size={12} className="text-gray-400" />
                        <select 
                            value={filters.role}
                            onChange={(e) => setFilters({...filters, role: e.target.value})}
                            className="bg-transparent text-[10px] font-black text-gray-700 focus:outline-none uppercase"
                        >
                            <option value="ALL">TODOS LOS ROLES</option>
                            <option value="ADMIN">ADMINISTRADOR</option>
                            <option value="CAJERO">CAJERO</option>
                            <option value="MESERO">MESERO</option>
                        </select>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                        <div className="relative h-7">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text"
                                placeholder="BUSCAR POR USUARIO O ACCIÓN..."
                                value={filters.search}
                                onChange={(e) => setFilters({...filters, search: e.target.value})}
                                className="w-full bg-white h-full pl-8 pr-4 border border-gray-300 focus:border-blue-500 focus:outline-none transition-all text-[10px] font-black uppercase tracking-wider shadow-inner"
                            />
                        </div>
                    </form>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col p-2 gap-4">
                <div className="flex-1 bg-white border border-gray-300 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b border-gray-300 sticky top-0 z-10">
                                    <th className="px-3 py-2 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200">FECHA / HORA</th>
                                    <th className="px-3 py-2 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200">USUARIO</th>
                                    <th className="px-3 py-2 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200">MÓDULO</th>
                                    <th className="px-3 py-2 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200">ACCIÓN</th>
                                    <th className="px-3 py-2 text-center text-[9px] font-black text-gray-500 uppercase tracking-widest">VER</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4">
                                                <div className="h-10 bg-slate-50 rounded-xl" />
                                            </td>
                                        </tr>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr 
                                            key={log.id} 
                                            className="hover:bg-blue-50/30 transition-colors group cursor-default border-b border-gray-100 h-10"
                                            onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                                        >
                                            <td className="px-3 py-1 whitespace-nowrap border-r border-gray-50">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-700 leading-none">{dayjs(log.created_at).format('DD/MM/YYYY')}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 tracking-tight">{dayjs(log.created_at).format('hh:mm:ss A')}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 border-r border-gray-50">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-black text-gray-800 uppercase tracking-tight leading-none">{log.user_name}</span>
                                                    <span className={`w-fit px-1 text-[8px] font-black uppercase tracking-tight border ${getRoleBadgeColor(log.user_role)}`}>
                                                        {log.user_role}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 border-r border-gray-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-blue-600 border border-blue-100 p-0.5 rounded-sm bg-blue-50/30">{getModuleIcon(log.module)}</span>
                                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-tighter">{log.module}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 border-r border-gray-50">
                                                <p className="text-[10px] font-bold text-gray-700 uppercase tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                                                    {log.action}
                                                </p>
                                            </td>
                                            <td className="px-3 py-1 text-center">
                                                <div className={`mx-auto w-5 h-5 flex items-center justify-center rounded-sm border transition-all ${
                                                    selectedLog?.id === log.id 
                                                        ? 'bg-[#106ebe] text-white border-[#106ebe]' 
                                                        : 'bg-white text-gray-400 border-gray-300 group-hover:bg-gray-50'
                                                }`}>
                                                    {selectedLog?.id === log.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <Info size={48} className="text-slate-200 mb-4" />
                                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No se encontraron registros</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Details Side Panel (only visible when a log is selected) */}
                {selectedLog && (
                    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-[100] border-l-2 border-[#106ebe] flex flex-col animate-slide-in-right">
                        <div className="p-4 bg-[#f0f0f0] border-b border-gray-300 flex items-center justify-between">
                            <div>
                                <h3 className="text-[11px] font-black text-[#106ebe] uppercase tracking-wider">DETALLES DEL MOVIMIENTO</h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">ID: {selectedLog.id}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="h-7 w-7 flex items-center justify-center bg-white border border-gray-300 text-gray-400 hover:text-red-500 transition-all shadow-sm"
                            >
                                <ChevronRight size={16} className="rotate-180" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            <div className="space-y-4">
                                {/* Context Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white p-3 border border-gray-200 shadow-sm">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1">Módulo</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#106ebe] font-bold">{getModuleIcon(selectedLog.module)}</span>
                                            <span className="text-[10px] font-black text-gray-700 uppercase">{selectedLog.module}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 border border-gray-200 shadow-sm">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1">Usuario</p>
                                        <span className="text-[10px] font-black text-gray-700 uppercase truncate block">{selectedLog.user_name}</span>
                                    </div>
                                </div>

                                {/* Action */}
                                <div className="bg-white p-3 border border-gray-200 shadow-sm">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1">Acción Realizada</p>
                                    <span className="text-[11px] font-black text-[#106ebe] uppercase leading-tight">{selectedLog.action}</span>
                                    {/* Severity Badge */}
                                    {selectedLog.details?._meta?.severity && selectedLog.details._meta.severity !== 'INFO' && (
                                        <span className={`ml-2 px-1.5 text-[7px] font-black uppercase tracking-tight border ${
                                            selectedLog.details._meta.severity === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-200' :
                                            selectedLog.details._meta.severity === 'WARNING' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                            selectedLog.details._meta.severity === 'FINANCIAL' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                            'bg-gray-50 text-gray-500 border-gray-200'
                                        }`}>
                                            {selectedLog.details._meta.severity}
                                        </span>
                                    )}
                                </div>

                                {/* Changes (Before/After) */}
                                {selectedLog.details?._changes && selectedLog.details._changes.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest ml-1">⚡ Cambios Detectados</p>
                                        <div className="bg-white border border-amber-200 shadow-sm overflow-hidden divide-y divide-amber-50">
                                            {selectedLog.details._changes.map((change: any, idx: number) => (
                                                <div key={idx} className="px-3 py-2">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block mb-1">{change.label || KEY_LABELS[change.field] || change.field}</span>
                                                    <div className="flex items-center gap-2 text-[10px]">
                                                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 border border-red-100 font-bold line-through">{String(change.before ?? '--')}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-100 font-black">{String(change.after ?? '--')}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Financial Impact */}
                                {selectedLog.details?._financial && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">💰 Impacto Financiero</p>
                                        <div className={`p-3 border shadow-sm ${
                                            selectedLog.details._financial.type === 'INGRESO' ? 'bg-emerald-50 border-emerald-200' :
                                            selectedLog.details._financial.type === 'EGRESO' ? 'bg-amber-50 border-amber-200' :
                                            selectedLog.details._financial.type === 'ANULACION' ? 'bg-red-50 border-red-200' :
                                            selectedLog.details._financial.type === 'DESCUENTO' ? 'bg-purple-50 border-purple-200' :
                                            'bg-gray-50 border-gray-200'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-1.5 text-[8px] font-black uppercase tracking-tight border ${
                                                    selectedLog.details._financial.type === 'INGRESO' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                                                    selectedLog.details._financial.type === 'EGRESO' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                                    selectedLog.details._financial.type === 'ANULACION' ? 'bg-red-100 text-red-700 border-red-300' :
                                                    selectedLog.details._financial.type === 'DESCUENTO' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                                    'bg-gray-100 text-gray-600 border-gray-300'
                                                }`}>
                                                    {selectedLog.details._financial.type}
                                                </span>
                                                <span className="text-[14px] font-black text-gray-900">
                                                    {selectedLog.details._financial.currency || 'Q'}{Number(selectedLog.details._financial.amount).toFixed(2)}
                                                </span>
                                            </div>
                                            {(selectedLog.details._financial.tax_amount || selectedLog.details._financial.tip_amount) && (
                                                <div className="flex gap-3 text-[9px] text-gray-500 font-bold">
                                                    {selectedLog.details._financial.tax_amount > 0 && <span>IVA: Q{Number(selectedLog.details._financial.tax_amount).toFixed(2)}</span>}
                                                    {selectedLog.details._financial.tip_amount > 0 && <span>Propina: Q{Number(selectedLog.details._financial.tip_amount).toFixed(2)}</span>}
                                                </div>
                                            )}
                                            {selectedLog.details._financial.payment_breakdown && (
                                                <div className="flex flex-wrap gap-2 mt-1.5 text-[8px] font-bold">
                                                    {Object.entries(selectedLog.details._financial.payment_breakdown).filter(([,v]) => Number(v) > 0).map(([k, v]) => (
                                                        <span key={k} className="bg-white px-1.5 py-0.5 border border-gray-200 text-gray-600 uppercase">{k}: Q{Number(v).toFixed(2)}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Parsed Details */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Atributos del Evento</p>
                                    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                                        {selectedLog.details && Object.entries(selectedLog.details)
                                            .filter(([key]) => !IGNORED_KEYS.includes(key))
                                            .length > 0 ? (
                                                Object.entries(selectedLog.details)
                                                    .filter(([key]) => !IGNORED_KEYS.includes(key))
                                                    .map(([key, value]) => (
                                                        <div key={key} className="px-3 py-2 flex items-center justify-between gap-4">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight leading-none whitespace-nowrap">
                                                                {KEY_LABELS[key] || key}
                                                            </span>
                                                            <div className="text-right text-[10px]">
                                                                {formatValue(key, value)}
                                                            </div>
                                                        </div>
                                                    ))
                                            ) : (
                                                <div className="p-8 text-center">
                                                    <Info size={24} className="mx-auto text-slate-200 mb-2" />
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Sin detalles adicionales registrados</p>
                                                </div>
                                            )}
                                    </div>
                                </div>

                                {/* Advanced JSON (Minimized toggle) */}
                                <details className="group">
                                    <summary className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors ml-1 list-none">
                                        <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
                                        Ver Metadata Técnica (JSON)
                                    </summary>
                                    <div className="mt-3 bg-[#106ebe] rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="bg-[#106ebe] px-5 py-3 border-b border-slate-700 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Código Crudo</span>
                                            <div className="flex gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
                                            </div>
                                        </div>
                                        <div className="p-5 overflow-x-auto">
                                            <pre className="text-[10px] font-mono text-emerald-500/80 leading-relaxed scrollbar-hide">
                                                {JSON.stringify(selectedLog.details, null, 4)}
                                            </pre>
                                        </div>
                                    </div>
                                </details>

                                {/* Help Note */}
                                <div className="bg-blue-50 p-3 border border-blue-100 flex gap-2">
                                    <Info className="text-blue-500 shrink-0" size={14} />
                                    <p className="text-[9px] font-bold text-blue-700 leading-tight">
                                        Este registro es inmutable y forma parte de la cadena de auditoría del sistema. 
                                        Solo personal autorizado puede exportar o depurar este historial.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Export Preview Modal */}
            {showExportModal && typeof document !== 'undefined' && createPortal(
                <div id="printable-report-wrapper" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print">
                    <div className="w-full max-w-5xl h-[90vh] bg-[#f0f0f0] shadow-2xl border border-[#106ebe] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-[#106ebe] h-10 px-4 flex items-center justify-between shrink-0 shadow-lg z-10">
                            <div className="flex items-center gap-3">
                                <FileSearch size={18} className="text-white" />
                                <span className="text-white text-[12px] font-black uppercase tracking-widest">VISUALIZADOR DE AUDITORÍA — LAS PALMAS</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => window.print()}
                                    className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Printer size={14} />
                                    IMPRIMIR REPORTE
                                </button>
                                <button 
                                    onClick={() => setShowExportModal(false)}
                                    className="h-7 w-7 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white transition-all ml-2"
                                >
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Preview Area (Paper Simulation) */}
                        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-200 custom-scrollbar">
                            <div className="bg-white w-[8.5in] min-h-[11in] p-[0.75in] shadow-xl origin-top print:m-0 print:shadow-none print:w-full" id="printable-report">
                                {/* Report Header */}
                                <div className="text-center border-b-2 border-[#106ebe] pb-4 mb-6">
                                    <h1 className="text-2xl font-black text-[#106ebe] m-0 tracking-tighter">RESTAURANTE LAS PALMAS — POS</h1>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">SISTEMA DE VIGILANCIA TOTAL E HISTORIAL DE ACTIVIDAD</p>
                                </div>

                                <div className="flex justify-between items-end mb-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-800 uppercase">
                                            <span className="text-gray-400">PERIODO:</span> {dayjs(filters.startDate).format('DD/MM/YYYY')} — {dayjs(filters.endDate).format('DD/MM/YYYY')}
                                        </p>
                                        <p className="text-[10px] font-black text-gray-800 uppercase">
                                            <span className="text-gray-400">FILTROS:</span> MOD: {filters.module} | ROL: {filters.role}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-gray-400">Generado el: {dayjs().format('DD/MM/YYYY HH:mm:ss')}</p>
                                        <p className="text-[9px] font-bold text-gray-400">Usuario: {logs[0]?.user_name || 'Admin'}</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <table className="w-full border-collapse text-[8.5px] table-fixed">
                                    <thead>
                                        <tr className="bg-gray-100 border border-gray-300">
                                            <th className="p-1 px-2 text-left border-r border-gray-300 font-black text-gray-600 w-20">FECHA/HORA</th>
                                            <th className="p-1 px-2 text-left border-r border-gray-300 font-black text-gray-600 w-28">USUARIO</th>
                                            <th className="p-1 px-2 text-left border-r border-gray-300 font-black text-gray-600 w-16">MÓDULO</th>
                                            <th className="p-1 px-2 text-left border-r border-gray-300 font-black text-gray-600">ACCIÓN / MOVIMIENTO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="border-x border-b border-gray-300">
                                        {logs.map((log) => (
                                            <tr key={log.id} className="border-b border-gray-200 hover:bg-slate-50">
                                                <td className="p-1 px-2 border-r border-gray-200 align-top">
                                                    <div className="font-bold">{dayjs(log.created_at).format('DD/MM/YYYY')}</div>
                                                    <div className="text-[7px] text-gray-400">{dayjs(log.created_at).format('HH:mm:ss')}</div>
                                                </td>
                                                <td className="p-1 px-2 border-r border-gray-200 align-top">
                                                    <div className="font-black text-gray-800 uppercase text-[8px]">{log.user_name}</div>
                                                    <div className="text-[7px] font-bold text-blue-600 uppercase">{log.user_role}</div>
                                                </td>
                                                <td className="p-1 px-2 border-r border-gray-200 align-top">
                                                    <span className="px-1 py-0 bg-slate-100 border border-slate-200 text-[7px] font-black uppercase text-slate-600 rounded-sm">
                                                        {log.module}
                                                    </span>
                                                </td>
                                                <td className="p-1 px-2 align-top">
                                                    <div className="font-black text-[#106ebe] uppercase text-[8px] mb-0.5">{log.action}</div>
                                                    <div className="text-[7px] text-gray-500 leading-none">
                                                        {log.details?._meta?.description || log.details?.accion_descripcion || 'Sin descripción'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                                    <div className="flex justify-center gap-20 my-12">
                                        <div className="w-48 border-t border-gray-400 pt-2 text-[8px] font-bold uppercase text-gray-400">
                                            Sello de Auditoría Digital
                                        </div>
                                        <div className="w-48 border-t border-gray-400 pt-2 text-[8px] font-bold uppercase text-gray-400">
                                            Firma Responsable
                                        </div>
                                    </div>
                                    <p className="text-[6px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-4">
                                        REGISTRO INMUTABLE — CADENA DE CUSTODIA DE DATOS LAS PALMAS POS — ID: {logs[0]?.id || 'AUTO'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Toolbar Bottom */}
                        <div className="bg-white border-t border-gray-300 p-3 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setShowExportModal(false)}
                                className="h-8 px-5 border border-gray-400 text-gray-600 text-[10px] font-black uppercase hover:bg-gray-100 transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button 
                                onClick={() => window.print()}
                                className="h-8 px-6 bg-[#106ebe] text-white text-[10px] font-black uppercase flex items-center gap-2 hover:bg-[#0d599a] transition-all shadow-md"
                            >
                                <Printer size={14} />
                                CONFIRMAR IMPRESIÓN
                            </button>
                        </div>
                    </div>

                    {/* Print Styles */}
                    <style>{`
                        @media print {
                            /* Ocultar TODO el contenido de la página excepto nuestro reporte */
                            body > * { display: none !important; }
                            #printable-report-wrapper { display: block !important; position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 0; }
                            #printable-report { 
                                display: block !important;
                                margin: 0 !important; 
                                border: none !important;
                                box-shadow: none !important;
                                width: 8.5in !important;
                                min-height: 11in !important;
                                padding: 0.5in !important;
                            }
                            .no-print { display: none !important; }
                            @page { size: letter; margin: 0; }
                        }
                    `}</style>
                </div>,
                document.body
            )}
        </div>
    );
};
