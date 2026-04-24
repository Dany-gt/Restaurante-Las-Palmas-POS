import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabase';
import {
    Calculator, TrendingUp, PieChart, Users, Wallet, Tag,
    Plus, Trash2, Save, FileText, Download, AlertCircle,
    CheckCircle2, ChevronDown, ChevronRight, Info, Eye, EyeOff
} from 'lucide-react';
import { useNotify } from '../../hooks/useNotify';

interface CostItem {
    id?: string;
    org_id: string;
    section: 'raw_material' | 'mod' | 'fixed' | 'variable';
    description: string;
    amount: number;
    persons?: number;
    base_salary?: number;
    benefits_pct?: number;
    sort_order: number;
    is_deletable?: boolean;
}

interface CostConfig {
    monthly_sales: number;
    operating_days: number;
}

export const CostControl: React.FC = () => {
    const notify = useNotify();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<CostConfig>({ monthly_sales: 275000, operating_days: 26 });
    const [items, setItems] = useState<CostItem[]>([]);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        raw_material: true,
        mod: true,
        fixed: true,
        variable: true
    });
    const [expandedMODRows, setExpandedMODRows] = useState<Record<string, boolean>>({});

    // Fetch Data on Mount
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Task 1: Fetch items ordered by section and sort_order
            const { data: itemsData, error: itemsError } = await supabase
                .from('cost_items')
                .select('*')
                .eq('org_id', 'default')
                .order('section')
                .order('sort_order');

            if (itemsError) throw itemsError;
            if (itemsData) setItems(itemsData);

            // Task 1: Fetch config
            const { data: configData, error: configError } = await supabase
                .from('cost_control_config')
                .select('*')
                .eq('org_id', 'default')
                .single();

            if (configError && configError.code !== 'PGRST116') throw configError;
            if (configData) setConfig({ monthly_sales: configData.monthly_sales, operating_days: configData.operating_days });
        } catch (error) {
            console.error('Error fetching data:', error);
            notify.error('Error al cargar datos de Supabase');
        } finally {
            setLoading(false);
        }
    };

    // Task 2: MOD Calculation Logic
    const calculateMODRow = (item: CostItem) => {
        const persons = Number(item.persons) || 0;
        const base_salary = Number(item.base_salary) || 0;
        const base = persons * base_salary;

        // Detailed Benefits
        const igss = base * 0.1067;
        const intecap = base * 0.01;
        const irtra = base * 0.01;
        const bonificacion = persons * 250;
        const aguinaldo = base / 12;
        const bono14 = base / 12;
        const vacaciones = base / 24;
        const indemnizacion = base / 12;

        const total = base + igss + intecap + irtra + bonificacion + aguinaldo + bono14 + vacaciones + indemnizacion;

        return {
            base, igss, intecap, irtra, bonificacion, aguinaldo, bono14, vacaciones, indemnizacion, total
        };
    };

    // Real-time calculations (Task 3)
    const totals = useMemo(() => {
        const raw = items.filter(i => i.section === 'raw_material').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        const mod = items.filter(i => i.section === 'mod').reduce((acc, i) => acc + calculateMODRow(i).total, 0);
        const fixed = items.filter(i => i.section === 'fixed').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        const variable = items.filter(i => i.section === 'variable').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

        return { raw, mod, fixed, variable };
    }, [items]);

    const primeCost = totals.raw + totals.mod;
    const totalOpex = primeCost + totals.fixed + totals.variable;
    const estimatedGrossProfit = config.monthly_sales - totalOpex;
    const profitMargin = config.monthly_sales > 0 ? (estimatedGrossProfit / config.monthly_sales) * 100 : 0;

    // Task 3: PE Formula exactly as requested
    const variableRatio = config.monthly_sales > 0 ? totals.variable / config.monthly_sales : 0;
    const fixedCostsForPE = totals.fixed + totals.mod; // Note: MOD included in fixed for PE as per request
    const breakEven = variableRatio < 1 ? fixedCostsForPE / (1 - variableRatio) : 0;
    const salesPerDay = config.monthly_sales > 0 ? config.monthly_sales / config.operating_days : 1;
    const daysToBreakEven = breakEven / salesPerDay;

    // Task 4: Auto-save Config
    const handleConfigChange = async (field: keyof CostConfig, value: number) => {
        const nextConfig = { ...config, [field]: value };
        setConfig(nextConfig);
        try {
            await supabase
                .from('cost_control_config')
                .upsert({ org_id: 'default', ...nextConfig }, { onConflict: 'org_id' });
        } catch (error) {
            console.error('Error saving config:', error);
        }
    };

    // Task 1: onBlur Auto-save for items
    const handleBlur = async (item: CostItem) => {
        if (!item.id) return;
        try {
            await supabase
                .from('cost_items')
                .update({
                    description: item.description,
                    amount: item.amount,
                    persons: item.persons,
                    base_salary: item.base_salary,
                    benefits_pct: item.benefits_pct
                })
                .eq('id', item.id);
        } catch (error) {
            console.error('Error auto-saving item:', error);
        }
    };

    // Task 1: Add New Row
    const addItem = async (section: CostItem['section']) => {
        const sectionItems = items.filter(i => i.section === section);
        const lastOrder = sectionItems.length > 0 ? Math.max(...sectionItems.map(i => i.sort_order)) : 0;

        const newItem: Partial<CostItem> = {
            org_id: 'default',
            section,
            description: 'Nueva fila',
            amount: 0,
            sort_order: lastOrder + 1,
            is_deletable: true
        };

        if (section === 'mod') {
            newItem.persons = 1;
            newItem.base_salary = 0;
            newItem.benefits_pct = 47.67;
        }

        try {
            const { data, error } = await supabase
                .from('cost_items')
                .insert(newItem)
                .select()
                .single();

            if (error) throw error;
            if (data) setItems([...items, data]);
        } catch (error) {
            notify.error('Error al crear nueva fila');
        }
    };

    // Task 1: Delete Row with is_deletable check
    const deleteItem = async (id: string, isDeletable?: boolean) => {
        if (isDeletable === false) {
            notify.error('Esta fila no puede ser eliminada');
            return;
        }
        try {
            const { error } = await supabase
                .from('cost_items')
                .delete()
                .eq('id', id)
                .eq('is_deletable', true);

            if (error) throw error;
            setItems(items.filter(i => i.id !== id));
            notify.success('Fila eliminada');
        } catch (error) {
            notify.error('Error al eliminar fila');
        }
    };

    // Task 1: Save All Changes
    const saveChanges = async () => {
        setSaving(true);
        try {
            // Upsert all items
            const { error } = await supabase
                .from('cost_items')
                .upsert(items, { onConflict: 'id' });

            if (error) throw error;
            notify.success('Todos los cambios guardados correctamente');
            fetchData();
        } catch (error) {
            notify.error('Error al guardar cambios masores');
        } finally {
            setSaving(false);
        }
    };

    // Task 5: CSV Export with custom format
    const exportToCSV = () => {
        const dateStr = new Date().toLocaleDateString();
        const rows = [
            ["CONTROL DE COSTOS - LAS PALMAS"],
            [`Fecha: ${dateStr}`],
            [`Ventas referencia: Q${config.monthly_sales.toLocaleString()}`],
            [""],
            ["COSTO PRIMO"],
            ["Sección", "Descripción", "Monto"]
        ];

        // Raw Materials
        items.filter(i => i.section === 'raw_material').forEach(i => {
            rows.push(["Materia Prima", i.description, `Q${i.amount.toFixed(2)}`]);
        });

        // MOD
        items.filter(i => i.section === 'mod').forEach(i => {
            const calc = calculateMODRow(i);
            rows.push(["MOD", `${i.description} (${i.persons})`, `Q${calc.base.toFixed(2)}`]);
            rows.push(["MOD - Prestaciones", i.description, `Q${(calc.total - calc.base).toFixed(2)}`]);
        });
        rows.push(["TOTAL COSTO PRIMO", "", `Q${primeCost.toFixed(2)}`]);
        rows.push([""]);

        // Fixed
        rows.push(["GASTOS FIJOS"], ["Descripción", "", "Monto"]);
        items.filter(i => i.section === 'fixed').forEach(i => {
            rows.push([i.description, "", `Q${i.amount.toFixed(2)}`]);
        });
        rows.push(["TOTAL GASTOS FIJOS", "", `Q${totals.fixed.toFixed(2)}`]);
        rows.push([""]);

        // Variable
        rows.push(["GASTOS VARIABLES"], ["Descripción", "", "Monto"]);
        items.filter(i => i.section === 'variable').forEach(i => {
            rows.push([i.description, "", `Q${i.amount.toFixed(2)}`]);
        });
        rows.push(["TOTAL GASTOS VARIABLES", "", `Q${totals.variable.toFixed(2)}`]);
        rows.push([""]);

        // Executive Summary
        rows.push(["RESUMEN EJECUTIVO"]);
        rows.push(["Total Costos Operativos", "", `Q${totalOpex.toFixed(2)}`]);
        rows.push(["Utilidad Bruta", "", `Q${estimatedGrossProfit.toFixed(2)}`]);
        rows.push(["Margen Utilidad %", "", `${profitMargin.toFixed(1)}%`]);
        rows.push(["Punto de Equilibrio", "", `Q${breakEven.toFixed(2)}`]);
        rows.push(["Días al Equilibrio", "", `${daysToBreakEven.toFixed(1)} días`]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Control_Costos_Las_Palmas_${dateStr.replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(val);
    };

    const getProfitIndicator = (margin: number) => {
        if (margin > 20) return { color: 'text-emerald-500', icon: '🟢', label: 'Utilidad Saludable (>20%)' };
        if (margin >= 10) return { color: 'text-amber-500', icon: '🟡', label: 'Margen Ajustado (10-20%)' };
        return { color: 'text-rose-500', icon: '🔴', label: 'Riesgo Crítico (<10%)' };
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full bg-[#fcfdfe]">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Conectando con Supabase...</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col md:flex-row h-full overflow-hidden bg-[#fcfdfe] font-sans selection:bg-indigo-100">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-8">
                <header className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-xl font-black text-[#106ebe] tracking-tight uppercase flex items-center gap-3">
                            <Calculator className="text-indigo-600" size={22} /> Control de Costos
                        </h1>
                        <p className="text-[9px] font-bold text-slate-600 tracking-widest uppercase mt-0.5">Estrategia & Rentabilidad Las Palmas</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <Download size={14} /> Exportar CSV
                        </button>
                        <button
                            onClick={saveChanges}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#106ebe] text-white hover:bg-black transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-[#106ebe]/10 disabled:opacity-60"
                        >
                            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Todo'}
                        </button>
                    </div>
                </header>

                {/* Section 1: Costo Primo */}
                <Section
                    title="Costo Primo"
                    icon={<TrendingUp size={18} />}
                    total={primeCost}
                    isExpanded={expandedSections.raw_material}
                    onToggle={() => setExpandedSections(p => ({ ...p, raw_material: !p.raw_material, mod: !p.mod }))}
                >
                    <div className="space-y-6">
                        {/* Materia Prima */}
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#106ebe]">Subsección A — Materia Prima</span>
                                <span className="text-[11px] font-bold text-indigo-600 uppercase">Subtotal: {formatCurrency(totals.raw)}</span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-100/50 border-b border-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3 text-right">Monto Mensual (Q)</th>
                                        <th className="px-4 py-3 text-center">% s/v</th>
                                        <th className="px-4 py-3 text-right w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.filter(i => i.section === 'raw_material').map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => {
                                                        const newItems = [...items];
                                                        const index = items.findIndex(i => i.id === item.id);
                                                        newItems[index].description = e.target.value;
                                                        setItems(newItems);
                                                    }}
                                                    onBlur={() => handleBlur(item)}
                                                    className="w-full bg-transparent text-[11px] font-bold text-[#106ebe] outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => {
                                                        const newItems = [...items];
                                                        const index = items.findIndex(i => i.id === item.id);
                                                        newItems[index].amount = Number(e.target.value);
                                                        setItems(newItems);
                                                    }}
                                                    onBlur={() => handleBlur(item)}
                                                    className="w-24 bg-transparent text-[11px] font-black text-[#106ebe] text-right outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center text-[10px] font-black text-indigo-600">
                                                {config.monthly_sales > 0 ? ((item.amount / config.monthly_sales) * 100).toFixed(1) : 0}%
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {item.is_deletable !== false && (
                                                    <button onClick={() => deleteItem(item.id!, item.is_deletable)} className="p-1 hover:text-rose-500 text-slate-500 transition-colors">
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => addItem('raw_material')} className="w-full py-2 bg-slate-100/30 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-700 transition-all border-t border-slate-100 flex items-center justify-center gap-2">
                                <Plus size={10} /> Agregar Fila
                            </button>
                        </div>

                        {/* MOD */}
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#106ebe]">Subsección B — Mano de Obra Directa (MOD) con Prestaciones</span>
                                <span className="text-[11px] font-bold text-orange-600 uppercase">Subtotal: {formatCurrency(totals.mod)}</span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-100/50 border-b border-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Puesto / Grupo</th>
                                        <th className="px-4 py-3 text-center">Pers.</th>
                                        <th className="px-4 py-3 text-right">Salario Base</th>
                                        <th className="px-4 py-3 text-center">Prest. %</th>
                                        <th className="px-4 py-3 text-right">Total Real</th>
                                        <th className="px-4 py-3 text-right w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.filter(i => i.section === 'mod').map((item, idx) => {
                                        const calc = calculateMODRow(item);
                                        const isExpanded = expandedMODRows[item.id!] || false;
                                        return (
                                            <React.Fragment key={item.id || idx}>
                                                <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => setExpandedMODRows(p => ({ ...p, [item.id!]: !isExpanded }))}>
                                                    <td className="px-4 py-4 flex items-center gap-2">
                                                        {isExpanded ? <EyeOff size={12} className="text-indigo-500" /> : <Eye size={12} className="text-slate-500 group-hover:text-indigo-500" />}
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => {
                                                                const newItems = [...items];
                                                                const index = items.findIndex(i => i.id === item.id);
                                                                newItems[index].description = e.target.value;
                                                                setItems(newItems);
                                                            }}
                                                            onBlur={() => handleBlur(item)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full bg-transparent text-[11px] font-bold text-[#106ebe] outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            value={item.persons}
                                                            onChange={(e) => {
                                                                const newItems = [...items];
                                                                const index = items.findIndex(i => i.id === item.id);
                                                                newItems[index].persons = Number(e.target.value);
                                                                setItems(newItems);
                                                            }}
                                                            onBlur={() => handleBlur(item)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-10 bg-transparent text-[11px] font-black text-[#106ebe] text-center outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <input
                                                            type="number"
                                                            value={item.base_salary}
                                                            onChange={(e) => {
                                                                const newItems = [...items];
                                                                const index = items.findIndex(i => i.id === item.id);
                                                                newItems[index].base_salary = Number(e.target.value);
                                                                setItems(newItems);
                                                            }}
                                                            onBlur={() => handleBlur(item)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-20 bg-transparent text-[11px] font-black text-[#106ebe] text-right outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-black text-slate-600">{item.benefits_pct}%</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[11px] font-black text-indigo-600">
                                                        {formatCurrency(calc.total)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        {item.is_deletable !== false && (
                                                            <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id!, item.is_deletable); }} className="p-1 hover:text-rose-500 text-slate-500 transition-colors">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-indigo-50/20">
                                                        <td colSpan={6} className="px-12 py-4 border-l-2 border-indigo-500">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-8">
                                                                <Benefit label="IGSS Patronal (10.67%)" value={calc.igss} />
                                                                <Benefit label="INTECAP (1%)" value={calc.intecap} />
                                                                <Benefit label="IRTRA (1%)" value={calc.irtra} />
                                                                <Benefit label="Bonificación Ley" value={calc.bonificacion} />
                                                                <Benefit label="Aguinaldo (Base/12)" value={calc.aguinaldo} />
                                                                <Benefit label="Bono 14 (Base/12)" value={calc.bono14} />
                                                                <Benefit label="Vacaciones (Base/24)" value={calc.vacaciones} />
                                                                <Benefit label="Indemnización (Base/12)" value={calc.indemnizacion} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <button onClick={() => addItem('mod')} className="w-full py-2 bg-slate-100/30 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-700 transition-all border-t border-slate-100 flex items-center justify-center gap-2">
                                <Plus size={10} /> Agregar Fila MOD
                            </button>
                        </div>
                    </div>
                </Section>

                {/* Section 2: Gastos Fijos */}
                <Section
                    title="Gastos Fijos"
                    icon={<Wallet size={18} />}
                    total={totals.fixed}
                    isExpanded={expandedSections.fixed}
                    onToggle={() => setExpandedSections(p => ({ ...p, fixed: !p.fixed }))}
                >
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 border-b border-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center">#</th>
                                    <th className="px-4 py-3">Descripción del Gasto</th>
                                    <th className="px-4 py-3 text-right">Monto (Q)</th>
                                    <th className="px-4 py-3 text-center">% s/v</th>
                                    <th className="px-4 py-3 text-right w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.filter(i => i.section === 'fixed').map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-500">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    const index = items.findIndex(i => i.id === item.id);
                                                    newItems[index].description = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                onBlur={() => handleBlur(item)}
                                                className="w-full bg-transparent text-[11px] font-bold text-[#106ebe] outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    const index = items.findIndex(i => i.id === item.id);
                                                    newItems[index].amount = Number(e.target.value);
                                                    setItems(newItems);
                                                }}
                                                onBlur={() => handleBlur(item)}
                                                className="w-24 bg-transparent text-[11px] font-black text-[#106ebe] text-right outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center text-[10px] font-black text-indigo-600">
                                            {config.monthly_sales > 0 ? ((item.amount / config.monthly_sales) * 100).toFixed(1) : 0}%
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => deleteItem(item.id!, item.is_deletable)} className="p-1 hover:text-rose-500 text-slate-500 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={() => addItem('fixed')} className="w-full py-2 bg-slate-100/30 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-700 transition-all border-t border-slate-100 flex items-center justify-center gap-2">
                            <Plus size={10} /> Agregar Gasto Fijo
                        </button>
                    </div>
                </Section>

                {/* Section 3: Gastos Variables */}
                <Section
                    title="Gastos Variables"
                    icon={<Tag size={18} />}
                    total={totals.variable}
                    isExpanded={expandedSections.variable}
                    onToggle={() => setExpandedSections(p => ({ ...p, variable: !p.variable }))}
                >
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 border-b border-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 w-10 text-center">#</th>
                                    <th className="px-4 py-3">Descripción del Gasto</th>
                                    <th className="px-4 py-3 text-right">Monto (Q)</th>
                                    <th className="px-4 py-3 text-center">% s/v</th>
                                    <th className="px-4 py-3 text-right w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.filter(i => i.section === 'variable').map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-500">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    const index = items.findIndex(i => i.id === item.id);
                                                    newItems[index].description = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                onBlur={() => handleBlur(item)}
                                                className="w-full bg-transparent text-[11px] font-bold text-[#106ebe] outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    const index = items.findIndex(i => i.id === item.id);
                                                    newItems[index].amount = Number(e.target.value);
                                                    setItems(newItems);
                                                }}
                                                onBlur={() => handleBlur(item)}
                                                className="w-24 bg-transparent text-[11px] font-black text-[#106ebe] text-right outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center text-[10px] font-black text-indigo-600">
                                            {config.monthly_sales > 0 ? ((item.amount / config.monthly_sales) * 100).toFixed(1) : 0}%
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => deleteItem(item.id!, item.is_deletable)} className="p-1 hover:text-rose-500 text-slate-500 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={() => addItem('variable')} className="w-full py-2 bg-slate-100/30 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-700 transition-all border-t border-slate-50 flex items-center justify-center gap-2">
                            <Plus size={10} /> Agregar Gasto Variable
                        </button>
                    </div>
                </Section>
            </div>

            {/* Sidebar: Executive Summary (Task 3 & 4) */}
            <aside className="w-full md:w-[280px] shrink-0 bg-white border-l border-slate-100 p-4 overflow-y-auto custom-scrollbar md:sticky top-0 h-fit md:h-full z-10 shadow-[-4px_0_20px_rgba(0,0,0,0.02)]">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xs font-black text-[#106ebe] tracking-widest uppercase mb-4 flex items-center gap-2">
                            <PieChart size={16} className="text-indigo-600" /> Resumen Ejecutivo
                        </h3>

                        <div className="bg-white border border-indigo-100 rounded-xl p-3 shadow-sm relative overflow-hidden group">
                            <div className="relative z-10">
                                <label className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.2em] block mb-1">Ventas Promedio Mensual (Q)</label>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-indigo-400">Q</span>
                                    <input
                                        type="number"
                                        value={config.monthly_sales}
                                        onChange={(e) => handleConfigChange('monthly_sales', Number(e.target.value))}
                                        className="bg-transparent text-base font-black text-[#106ebe] outline-none w-full border-b border-slate-100 focus:border-indigo-400 transition-all placeholder:text-slate-200"
                                    />
                                </div>
                                <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2">
                                    <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Días Operativos</label>
                                    <input
                                        type="number"
                                        value={config.operating_days}
                                        onChange={(e) => handleConfigChange('operating_days', Number(e.target.value))}
                                        className="bg-slate-50 text-[9px] font-black text-slate-800 text-center w-7 py-0.5 rounded outline-none border border-slate-100"
                                    />
                                </div>
                            </div>
                            <div className="absolute -bottom-4 -right-4 text-indigo-50 opacity-10">
                                <Calculator size={120} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <KPICard title="Costo Primo" value={primeCost} sales={config.monthly_sales} meta="Meta: <60%" />
                        <KPICard title="Gastos Fijos" value={totals.fixed} sales={config.monthly_sales} />
                        <KPICard title="Gastos Variables" value={totals.variable} sales={config.monthly_sales} />
                        <KPICard title="Total Costos Operativos" value={totalOpex} sales={config.monthly_sales} isHighlighted />

                        <div className={`p-3 rounded-xl border shadow-sm transition-all bg-white flex flex-col items-center text-center ${profitMargin < 10 ? 'border-rose-100 bg-rose-50/10' : 'border-slate-100'}`}>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Utilidad Bruta Estimada</span>
                            <div className="text-xl font-black text-[#106ebe] mb-0.5">{formatCurrency(estimatedGrossProfit)}</div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-black ${getProfitIndicator(profitMargin).color}`}>
                                    {getProfitIndicator(profitMargin).icon} {profitMargin.toFixed(1)}%
                                </span>
                                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">del total de ventas</span>
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-tighter mt-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 ${getProfitIndicator(profitMargin).color}`}>
                                {getProfitIndicator(profitMargin).label}
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-100 bg-indigo-50/10 flex flex-col relative overflow-hidden">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                <Info size={13} /> PE (Equilibrio)
                            </span>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[10px] font-black text-[#106ebe] uppercase tracking-wider mb-0.5">Ventas necesarias:</div>
                                    <div className="text-lg font-black text-slate-800 leading-none">{formatCurrency(breakEven)}</div>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">Suma de costos fijos (incl. MOD) / (1 - %Variable)</p>
                                </div>
                                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase leading-none">Día del equilibrio:</span>
                                    </div>
                                    <span className={`text-2xl font-black tracking-tighter ${daysToBreakEven > config.operating_days ? 'text-rose-500' : 'text-indigo-600'}`}>
                                        {daysToBreakEven > config.operating_days ? 'FAIL' : Math.ceil(daysToBreakEven)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            <p className="text-[9px] font-bold text-emerald-800 leading-tight">Módulo conectado a Supabase en tiempo real. Todos los cambios se sincronizan al perder foco.</p>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

const Section: React.FC<{
    title: string;
    icon: React.ReactNode;
    total: number;
    children: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ title, icon, total, children, isExpanded, onToggle }) => (
    <div className="space-y-4">
        <button
            onClick={onToggle}
            className="flex items-center justify-between w-full p-2 group hover:translate-x-1 transition-transform"
        >
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-white border border-slate-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    {icon}
                </div>
                <div className="text-left">
                    <h2 className="text-base font-black text-[#106ebe] uppercase tracking-tight leading-none">{title}</h2>
                    <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5 tracking-wider">Gestión Operativa Mensual</p>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="text-[8px] font-black text-slate-500 uppercase block leading-none mb-1">Subtotal</span>
                    <span className="text-lg font-black text-[#106ebe]">{new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(total)}</span>
                </div>
                <div className={`text-slate-500 p-1 rounded-full hover:bg-slate-100 transition-all ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={22} />
                </div>
            </div>
        </button>
        <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
            {children}
        </div>
    </div>
);

const KPICard: React.FC<{
    title: string;
    value: number;
    sales: number;
    meta?: string;
    isHighlighted?: boolean;
}> = ({ title, value, sales, meta, isHighlighted }) => {
    const pct = sales > 0 ? (value / sales) * 100 : 0;
    return (
        <div className={`p-3 rounded-2xl border transition-all ${isHighlighted ? 'bg-indigo-50/40 border-indigo-100 shadow-indigo-100/30' : 'bg-white border-slate-100 hover:border-slate-200'} shadow-sm relative overflow-hidden`}>
            {isHighlighted && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />}
            <div className="flex justify-between items-start mb-1.5 relative z-10">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isHighlighted ? 'text-indigo-600' : 'text-slate-400'}`}>{title}</span>
                <span className={`text-[10px] font-black ${isHighlighted ? 'text-indigo-600' : 'text-[#106ebe]'}`}>{pct.toFixed(1)}%</span>
            </div>
            <div className={`text-base font-black relative z-10 ${isHighlighted ? 'text-indigo-900' : 'text-[#106ebe]'}`}>
                {new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(value)}
            </div>
            {meta && (
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-50 relative z-10">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Comparativo Insumo:</span>
                    <span className="text-[8px] font-black text-amber-500 uppercase">{meta}</span>
                </div>
            )}
        </div>
    );
};

const Benefit: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex flex-col">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-[10px] font-black text-slate-700">{new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(value)}</span>
    </div>
);
