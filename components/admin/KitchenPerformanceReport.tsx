import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    ChefHat, Calendar, Search, TrendingUp, Clock,
    AlertTriangle, CheckCircle2, RefreshCw, Loader2, ChevronUp, ChevronDown, Filter, Target,
    Hash
} from 'lucide-react';

interface DishPrep {
    id: string;
    created_at: string;
    product_name: string;
    category_name: string;
    station_name: string;
    cook_seconds: number;
    target_seconds: number;
}

interface KitchenStation {
    id: string;
    name: string;
}

type SortKey = 'product_name' | 'cook_seconds' | 'created_at' | 'target_seconds';

const fmtTime = (secs: number): string => {
    if (!secs || secs <= 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
};

const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
};

export const KitchenPerformanceReport: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const initialStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `KitchenPerformanceReport_State_${userId}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [startDate, setStartDate] = useState(savedState?.startDate || initialStartDate);
    const [endDate, setEndDate] = useState(savedState?.endDate || today);
    const [loading, setLoading] = useState(false);
    const [preps, setPreps] = useState<DishPrep[]>(savedState?.preps || []);
    const [searched, setSearched] = useState(savedState?.searched || false);
    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filterText, setFilterText] = useState('');

    const [stations, setStations] = useState<KitchenStation[]>([]);
    const [selectedStationId, setSelectedStationId] = useState<string>(savedState?.selectedStationId || '');
    const [globalPrepMinutes, setGlobalPrepMinutes] = useState<number>(savedState?.globalPrepMinutes || 2);

    useEffect(() => {
        const state = { preps, searched, selectedStationId, globalPrepMinutes, startDate, endDate };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [preps, searched, selectedStationId, globalPrepMinutes, startDate, endDate, STORAGE_KEY]);

    useEffect(() => {
        supabase
            .from('kitchen_stations')
            .select('id, name')
            .eq('is_enabled', true)
            .order('name')
            .then(({ data }) => { if (data) setStations(data); });

        supabase
            .from('menu_costing_config')
            .select('prep_time_minutes')
            .eq('org_id', 'default')
            .single()
            .then(({ data }) => { if (data?.prep_time_minutes) setGlobalPrepMinutes(data.prep_time_minutes); });
    }, []);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        setSearched(true);

        const { data, error } = await supabase
            .from('order_items')
            .select(`
                id,
                created_at,
                cook_duration_seconds,
                products:products(name, kitchen_station_id, prep_time, kitchen_stations(name), categories(name))
            `)
            .not('cook_duration_seconds', 'is', null)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Kitchen Performance Report error:', error);
            setLoading(false);
            return;
        }

        const filteredRows = (data || []).filter((row: any) => {
            if (!selectedStationId) return true;
            return row.products?.kitchen_station_id === selectedStationId;
        });

        const mapped: DishPrep[] = filteredRows.map((row: any) => {
            const rawPrepTime = row.products?.prep_time;
            const targetMins = rawPrepTime != null && rawPrepTime !== ''
                ? parseFloat(rawPrepTime)
                : globalPrepMinutes;

            return {
                id: row.id,
                created_at: row.created_at,
                product_name: row.products?.name || 'Desconocido',
                category_name: row.products?.categories?.name || '—',
                station_name: row.products?.kitchen_stations?.name || '—',
                cook_seconds: row.cook_duration_seconds as number,
                target_seconds: Math.round(targetMins * 60)
            };
        });

        setPreps(mapped);
        setLoading(false);
    }, [startDate, endDate, selectedStationId, globalPrepMinutes]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const sorted = [...preps]
        .filter(p => p.product_name.toLowerCase().includes(filterText.toLowerCase()) ||
            p.category_name.toLowerCase().includes(filterText.toLowerCase()) ||
            p.station_name.toLowerCase().includes(filterText.toLowerCase()))
        .sort((a, b) => {
            const mult = sortDir === 'asc' ? 1 : -1;
            if (sortKey === 'product_name') return mult * a.product_name.localeCompare(b.product_name);
            if (sortKey === 'created_at') return mult * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return mult * (a[sortKey] - b[sortKey]);
        });

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return null;
        return sortDir === 'asc' ? <ChevronUp size={10} className="inline ml-1" /> : <ChevronDown size={10} className="inline ml-1" />;
    };

    const perfColor = (real: number, target: number) => {
        if (!target) return 'text-gray-500 bg-gray-50';
        const ratio = real / target;
        if (ratio <= 1.0) return 'text-emerald-600 bg-emerald-50';
        if (ratio <= 1.5) return 'text-amber-600 bg-amber-50';
        return 'text-rose-600 bg-rose-50';
    };

    const perfIcon = (real: number, target: number) => {
        if (!target) return <CheckCircle2 size={15} className="text-gray-300" />;
        const ratio = real / target;
        if (ratio <= 1.0) return <CheckCircle2 size={15} className="text-emerald-500" />;
        if (ratio <= 1.5) return <AlertTriangle size={15} className="text-amber-400" />;
        return <AlertTriangle size={15} className="text-rose-500" />;
    };

    const selectedStationLabel = selectedStationId
        ? stations.find(s => s.id === selectedStationId)?.name || 'Área'
        : 'TODAS LAS ÁREAS';

    return (
        <div className="w-full h-full bg-[#f0f0f0] flex flex-col overflow-hidden">

            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-end gap-4 shrink-0">
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Calendar size={10} /> Inicio</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Calendar size={10} /> Fin</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Filter size={10} /> Área</label>
                    <select value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none min-w-[140px]">
                        <option value="">— Todas —</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Target size={10} /> Objetivo (min)</label>
                    <input type="number" value={globalPrepMinutes} onChange={e => setGlobalPrepMinutes(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none w-16 text-center" />
                </div>
                <button onClick={fetchReport} disabled={loading} className="bg-[#106ebe] hover:bg-black text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Consultar
                </button>
                {searched && preps.length > 0 && (
                    <div className="relative ml-auto">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Buscar..." value={filterText} onChange={e => setFilterText(e.target.value)} className="border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none w-52" />
                    </div>
                )}
            </div>

            <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-6 shrink-0">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Semáforo:</span>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] text-gray-500">A tiempo</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[9px] text-gray-500">Retraso (-50%)</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[9px] text-gray-500">Crítico (+50%)</span></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {searched && !loading && preps.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="bg-indigo-50 px-5 py-2 border-b border-indigo-100 flex items-center gap-2">
                            <TrendingUp size={13} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                {sorted.length} preparaciones individuales encontradas en {selectedStationLabel}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        {[
                                            { key: 'created_at' as SortKey, label: 'FECHA/HORA' },
                                            { key: 'product_name' as SortKey, label: 'PLATILLO' },
                                            { key: null, label: 'ÁREA' },
                                            { key: 'target_seconds' as SortKey, label: 'OBJETIVO' },
                                            { key: 'cook_seconds' as SortKey, label: 'TIEMPO REAL' },
                                        ].map(col => (
                                            <th key={col.label} onClick={() => col.key && handleSort(col.key)} className={`text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400 ${col.key ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}>
                                                {col.label}{col.key && <SortIcon col={col.key} />}
                                            </th>
                                        ))}
                                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">ESTADO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((row, i) => (
                                        <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                            <td className="px-4 py-3 text-[10px] font-bold text-gray-500 whitespace-nowrap">{fmtDateTime(row.created_at)}</td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-gray-800">{row.product_name}</td>
                                            <td className="px-4 py-3"><span className="text-[9px] font-black bg-[#106ebe]/10 text-[#106ebe] px-2 py-0.5 rounded-full uppercase">{row.station_name}</span></td>
                                            <td className="px-4 py-3"><span className="text-[10px] font-bold text-gray-400">{fmtTime(row.target_seconds)}</span></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[11px] font-black px-2 py-1 rounded-md ${perfColor(row.cook_seconds, row.target_seconds)}`}>
                                                        {fmtTime(row.cook_seconds)}
                                                    </span>
                                                    {row.cook_seconds > row.target_seconds && (
                                                        <span className="text-[8px] text-rose-400 font-bold">+{fmtTime(row.cook_seconds - row.target_seconds)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{perfIcon(row.cook_seconds, row.target_seconds)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {searched && !loading && preps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                        <AlertTriangle size={28} className="text-amber-400" />
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">No hay preparaciones registradas para este periodo.</p>
                    </div>
                )}

                {!searched && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-4 opacity-40">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center"><Clock size={32} className="text-gray-400" /></div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">Presiona Consultar para ver el rendimiento individual</p>
                    </div>
                )}
            </div>
        </div>
    );
};
