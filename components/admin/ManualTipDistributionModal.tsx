import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Calculator,
    Users,
    UserPlus,
    Trash2,
    ClipboardCheck,
    FileText,
    CheckCircle2,
    ChefHat,
    Wallet,
    Info
} from 'lucide-react';
import { supabase } from '../../supabase';
import { generateUUID } from '../../utils/uuid';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { DraggableWindow } from './DraggableWindow';

const formatCurr = (v: number) => (v || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

interface EmployeeRow {
    id: string;
    name: string;
    vales: number;
}

interface Props {
    onClose: () => void;
    totalBruta: number;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    waiterData?: any[];
}

export const ManualTipDistributionModal: React.FC<Props> = ({
    onClose,
    totalBruta: initialTotalBruta,
    branchId,
    startDate,
    endDate,
    waiterData = []
}) => {
    const [waiterVales, setWaiterVales] = useState<Record<string, number>>({});
    const [employees, setEmployees] = useState<EmployeeRow[]>([
        { id: generateUUID(), name: '', vales: 0 }
    ]);

    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const results = useMemo(() => {
        let totalRetencionAdmin = 0;
        let totalFondoApoyo = 0;
        let totalFondoMeseros = 0;

        const meseros = (waiterData || []).map(w => {
            const bruto = w.totals?.total || 0;
            const facturado = w.totals?.facturado || 0;
            const impuestoIndividual = facturado * 0.17;
            const liquidoIndividual = bruto - impuestoIndividual;
            const share55 = liquidoIndividual * 0.55;
            const contribution45 = liquidoIndividual * 0.45;
            const vales = waiterVales[w.name] || 0;

            totalRetencionAdmin += impuestoIndividual;
            totalFondoMeseros += share55;
            totalFondoApoyo += contribution45;

            return {
                name: w.name,
                bruto,
                facturado,
                impuesto: impuestoIndividual,
                liquido: liquidoIndividual,
                share55,
                vales,
                neto: share55 - vales
            };
        }).sort((a, b) => b.neto - a.neto);

        const basePorPersonaApoyo = employees.length > 0 ? totalFondoApoyo / employees.length : 0;

        return {
            totalRetencionAdmin,
            totalFondoMeseros,
            totalFondoApoyo,
            meseros,
            basePorPersonaApoyo
        };
    }, [waiterVales, waiterData, employees.length]);

    const updateWaiterVale = (name: string, value: number) => {
        setWaiterVales(prev => ({ ...prev, [name]: value }));
    };

    const addEmployee = () => setEmployees([...employees, { id: generateUUID(), name: '', vales: 0 }]);
    const removeEmployee = (id: string) => employees.length > 1 && setEmployees(employees.filter(e => e.id !== id));
    const updateEmployee = (id: string, field: keyof EmployeeRow, value: string | number) =>
        setEmployees(employees.map(e => e.id === id ? { ...e, [field]: value } : e));

    const handleSave = async () => {
        setLoading(true);
        try {
            const { data: dist, error: distError } = await supabase.from('tip_distributions').insert([{
                total_bruta: initialTotalBruta,
                retencion_manual: results.totalRetencionAdmin,
                total_liquido: results.totalFondoMeseros + results.totalFondoApoyo,
                fondo_meseros: results.totalFondoMeseros,
                fondo_apoyo: results.totalFondoApoyo,
                cantidad_personas_apoyo: employees.length,
                participacion_base: results.basePorPersonaApoyo,
                branch_id: branchId, periodo_inicio: startDate, periodo_fin: endDate
            }]).select().single();
            if (distError) throw distError;

            const itemsApoyo = employees.map(e => ({
                distribution_id: dist.id,
                employee_name: e.name,
                vales_adelantos: e.vales,
                monto_neto: results.basePorPersonaApoyo - e.vales,
                type: 'APOYO'
            }));

            const itemsMeseros = results.meseros.map(m => ({
                distribution_id: dist.id,
                employee_name: m.name,
                vales_adelantos: m.vales,
                monto_neto: m.neto,
                type: 'MESERO'
            }));

            await supabase.from('tip_distribution_items').insert([...itemsApoyo, ...itemsMeseros]);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        } finally { setLoading(false); }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 select-none">
            <DraggableWindow id="manual-tip-distribution" title="Liquidación de Propinas">
                <div className="w-[1100px] bg-[#fdfdfd] border-2 border-[#106ebe] shadow-[0_30px_90px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">

                    <div className="modal-header bg-[#106ebe] h-9 px-4 flex justify-between items-center cursor-move border-b border-black">
                        <div className="flex items-center gap-2 pointer-events-none">
                            <ClipboardCheck size={16} className="text-emerald-400" />
                            <span className="text-white text-[11px] font-black uppercase tracking-widest">Liquidación Individualizada de Propinas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <WindowsSaveButton onClick={() => setShowConfirm(true)} loading={loading} variant="minimal" title="Finalizar" />
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-red-600 text-white transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[92vh]">
                        <div className="bg-[#fff9db] border-2 border-amber-300 p-2.5 flex items-center gap-3">
                            <Info size={18} className="text-amber-700 shrink-0" />
                            <p className="text-[11px] font-black text-amber-900 leading-tight uppercase">
                                Regla de Negocio: Se aplica 17% de retención solo al monto facturado de cada mesero por separado.
                            </p>
                        </div>

                        <div className="grid grid-cols-12 gap-5">
                            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                                <div className="bg-white border-2 border-slate-200 p-4 shadow-sm">
                                    <h3 className="text-[10px] font-black uppercase text-slate-800 border-b-2 border-slate-100 pb-2 mb-3">Balance Global</h3>
                                    <div className="space-y-4">
                                        <div className="flex flex-col items-center p-2 bg-slate-50">
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Recaudación Bruta</span>
                                            <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{formatCurr(initialTotalBruta)}</span>
                                        </div>
                                        <div className="p-3 bg-red-50 border-2 border-red-100 flex flex-col items-center">
                                            <span className="text-[9px] font-black text-red-700 uppercase">Retención Admin (17%)</span>
                                            <span className="text-xl font-black text-red-600 font-mono">{formatCurr(results.totalRetencionAdmin)}</span>
                                        </div>
                                        <div className="p-3 bg-[#106ebe] flex flex-col items-center text-white">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Neto Total a Pagar</span>
                                            <span className="text-xl font-black text-emerald-400 font-mono">{formatCurr(results.totalFondoMeseros + results.totalFondoApoyo)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-12 lg:col-span-9 flex flex-col gap-5">
                                <div className="bg-white border-2 border-slate-300 shadow-sm flex flex-col">
                                    <div className="bg-[#106ebe] p-2.5 flex items-center gap-2">
                                        <Users size={14} className="text-blue-400" />
                                        <span className="text-[10px] font-black uppercase text-white tracking-widest">Detalle Fiscal de Meseros</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 border-b-2 border-slate-200 text-[9px] font-black text-slate-700 uppercase">
                                                <tr>
                                                    <th className="px-3 py-2">Colaborador</th>
                                                    <th className="px-3 py-2 text-right text-orange-700">Facturado</th>
                                                    <th className="px-3 py-2 text-right text-red-700">Impuesto</th>
                                                    <th className="px-3 py-2 text-right text-emerald-800">Sub 55%</th>
                                                    <th className="px-3 py-2 text-center w-24">Vales</th>
                                                    <th className="px-3 py-2 text-right text-blue-800">Neto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 text-[11px] font-black text-slate-800 uppercase bg-white">
                                                {results.meseros.map((m, i) => (
                                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                                        <td className="px-3 py-2 border-r border-slate-100 font-bold">{m.name}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-orange-700">{formatCurr(m.facturado)}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-red-700">{formatCurr(m.impuesto)}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-emerald-800">{formatCurr(m.share55)}</td>
                                                        <td className="px-2 py-1">
                                                            <input
                                                                type="number"
                                                                className="w-full h-7 bg-white border-2 border-slate-300 outline-none text-red-600 text-center font-mono font-black focus:border-red-500"
                                                                value={m.vales || ''}
                                                                onChange={e => updateWaiterVale(m.name, parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono text-blue-900 bg-blue-50/50">{formatCurr(m.neto)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
            {showConfirm && <WindowsConfirmModal title="Finalizar Distribución" message={`¿Deseas guardar esta distribución?`} onConfirm={handleSave} onCancel={() => setShowConfirm(false)} />}
        </div>,
        document.body
    );
};
