import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    Layers, Calendar, Search, TrendingUp, Clock,
    RefreshCw, Loader2, Users, FileSpreadsheet,
    ChefHat, AlertTriangle, BarChart3
} from 'lucide-react';

interface RendimientoRecord {
    id: string;
    platillo_id: string;
    platillo_nombre: string;
    categoria: string;
    usuario_id: string;
    usuario_nombre: string;
    tiempo_inicio: string;
    tiempo_fin: string;
    duracion_segundos: number;
    sucursal_id: string;
    fecha: string;
}

interface Sucursal {
    id: string;
    name: string;
}

const formatHMS = (secs: number): string => {
    if (!secs || secs <= 0) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatFecha = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
};

export const RendimientoProduccion: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const initialStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Admin ve todas las sucursales por defecto
    const [fechaDesde, setFechaDesde] = useState(initialStart);
    const [fechaHasta, setFechaHasta] = useState(today);
    const [sucursalId, setSucursalId] = useState('');
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [filterText, setFilterText] = useState('');

    const [data, setData] = useState<RendimientoRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Load sucursales
    useEffect(() => {
        supabase.from('branches').select('id, name').order('name')
            .then(({ data: brs }) => { if (brs) setSucursales(brs); });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setSearched(true);

        let query = supabase
            .from('rendimiento_cocina')
            .select('*')
            .eq('categoria', 'PRODUCCION')
            .gte('fecha', `${fechaDesde}T00:00:00`)
            .lte('fecha', `${fechaHasta}T23:59:59`)
            .order('fecha', { ascending: false });

        if (sucursalId) {
            query = query.eq('sucursal_id', sucursalId);
        }

        const { data: rows, error } = await query;

        if (error) {
            console.error('[RendimientoProduccion] Error:', error);
            setData([]);
        } else {
            setData(rows || []);
        }
        setLoading(false);
    }, [fechaDesde, fechaHasta, sucursalId]);

    // Métricas del resumen
    const totalProducciones = data.length;
    const tiempoPromedio = data.length > 0
        ? Math.round(data.reduce((acc, r) => acc + r.duracion_segundos, 0) / data.length)
        : 0;
    const cocineros = [...new Set(data.map(r => r.usuario_nombre))];

    // Filtered rows
    const filtered = data.filter(r =>
        r.usuario_nombre.toLowerCase().includes(filterText.toLowerCase()) ||
        r.platillo_nombre.toLowerCase().includes(filterText.toLowerCase())
    );

    // Export to Excel
    const exportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const rows = filtered.map(r => ({
                'Cocinero': r.usuario_nombre,
                'Platillo': r.platillo_nombre,
                'Duración': formatHMS(r.duracion_segundos),
                'Duración (seg)': r.duracion_segundos,
                'Fecha Inicio': formatFecha(r.tiempo_inicio),
                'Fecha Fin': formatFecha(r.tiempo_fin),
                'Sucursal': r.sucursal_id,
                'Categoría': r.categoria
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rendimiento Producción');

            const fechaStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Rendimiento_Produccion_${fechaStr}.xlsx`);
        } catch (e) {
            console.error('Error exportando Excel:', e);
            alert('Error al exportar Excel. Verifique que la librería xlsx esté instalada.');
        }
    };

    return (
        <div className="w-full h-full bg-[#f0f0f0] flex flex-col overflow-hidden font-sans">

            {/* ── Toolbar ── */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-end gap-4 shrink-0">
                <div className="flex-1 min-w-0">
                    <h1 className="text-[13px] font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                        <Layers size={16} className="text-[#106ebe]" />
                        RENDIMIENTO DE PRODUCCIÓN
                    </h1>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        Historial por trabajador — Módulo PRODUCCION
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Calendar size={10} /> Desde
                        </label>
                        <input
                            type="date" value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Calendar size={10} /> Hasta
                        </label>
                        <input
                            type="date" value={fechaHasta}
                            onChange={e => setFechaHasta(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Search size={10} /> Sucursal
                        </label>
                        <select
                            value={sucursalId}
                            onChange={e => setSucursalId(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none min-w-[160px]"
                        >
                            <option value="">— Todas —</option>
                            {sucursales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-[#106ebe] hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Filtrar
                    </button>

                    {searched && data.length > 0 && (
                        <button
                            onClick={exportExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <FileSpreadsheet size={14} />
                            Exportar XLS
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

                {/* ── Tarjetas de resumen ── */}
                {searched && !loading && data.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-[#106ebe]/10 flex items-center justify-center">
                                <BarChart3 size={22} className="text-[#106ebe]" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Producciones</p>
                                <p className="text-[28px] font-black text-gray-800 leading-none">{totalProducciones}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                                <Clock size={22} className="text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tiempo Promedio</p>
                                <p className="text-[22px] font-black text-gray-800 leading-none tabular-nums">{formatHMS(tiempoPromedio)}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Users size={22} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cocineros</p>
                                <p className="text-[28px] font-black text-gray-800 leading-none">{cocineros.length}</p>
                                <p className="text-[8px] text-gray-400 mt-0.5 truncate max-w-[120px]">
                                    {cocineros.slice(0, 3).join(', ')}{cocineros.length > 3 ? '...' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Buscador inline ── */}
                {searched && data.length > 0 && (
                    <div className="flex gap-3 items-center">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar cocinero o platillo..."
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-[11px] font-bold outline-none bg-white"
                            />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">
                            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* ── Tabla de detalle ── */}
                {searched && !loading && filtered.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="bg-[#106ebe]/5 px-5 py-2.5 border-b border-[#106ebe]/10 flex items-center gap-2">
                            <TrendingUp size={13} className="text-[#106ebe]" />
                            <span className="text-[10px] font-black text-[#106ebe] uppercase tracking-widest">
                                DETALLE POR COCINERO — CATEGORÍA PRODUCCION
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Cocinero</th>
                                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Platillo</th>
                                        <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Duración</th>
                                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Fecha / Hora Inicio</th>
                                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Hora Fin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((row, i) => (
                                        <tr
                                            key={row.id}
                                            className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-[#106ebe]/10 flex items-center justify-center text-[#106ebe] font-black text-xs shrink-0">
                                                        {row.usuario_nombre.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-800">{row.usuario_nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] font-bold text-gray-700">{row.platillo_nombre}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[11px] font-black tabular-nums text-[#106ebe] bg-[#106ebe]/10 px-2 py-1 rounded-md">
                                                    {formatHMS(row.duracion_segundos)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-gray-500 whitespace-nowrap">
                                                {formatFecha(row.tiempo_inicio)}
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-gray-500 whitespace-nowrap">
                                                {formatFecha(row.tiempo_fin)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Estado vacío ── */}
                {searched && !loading && data.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                        <AlertTriangle size={28} className="text-amber-400" />
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                            No hay registros de producción para este período.
                        </p>
                        <p className="text-[10px] text-gray-400">
                            Asegúrate de haber ejecutado el SQL de creación de la tabla <code className="bg-gray-100 px-1 rounded">rendimiento_cocina</code>.
                        </p>
                    </div>
                )}

                {/* ── Inicial ── */}
                {!searched && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-4 opacity-40">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                            <Layers size={32} className="text-gray-400" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                            Selecciona el rango de fechas y presiona Filtrar
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RendimientoProduccion;
