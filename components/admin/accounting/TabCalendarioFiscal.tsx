import React, { useState } from 'react';
import dayjs from 'dayjs';

interface CalEvent {
    day: number;
    months: number[]; // 0=all, or specific month index 0-11
    label: string;
    type: 'iva' | 'igss' | 'isr' | 'prestacion';
    tabId?: string;
    note?: string;
}

const RECURRING: CalEvent[] = [
    { day: 15, months: [], label: 'Declaración IVA (SAT-2048)', type: 'iva', tabId: 'iva', note: 'Formulario SAT-2048' },
    { day: 20, months: [], label: 'Pago Cuotas IGSS Patronal', type: 'igss', tabId: 'planilla' },
    { day: 25, months: [], label: 'Pago Planilla Empleados', type: 'igss', tabId: 'planilla' },
];

const QUARTERLY: { month: number; day: number; label: string }[] = [
    { month: 3, day: 30, label: 'ISR T1 (Ene-Feb-Mar)' },
    { month: 6, day: 31, label: 'ISR T2 (Abr-May-Jun)' },
    { month: 9, day: 31, label: 'ISR T3 (Jul-Ago-Sep)' },
    { month: 0, day: 31, label: 'ISR T4 (Oct-Nov-Dic)' }, // January next year
];

const ANNUAL: { month: number; day: number; label: string; type: CalEvent['type']; note?: string }[] = [
    { month: 5, day: 30, label: 'Pago Bono 14', type: 'prestacion' },
    { month: 11, day: 31, label: 'Pago Aguinaldo', type: 'prestacion' },
    { month: 11, day: 31, label: 'Cierre Fiscal', type: 'isr' },
    { month: 2, day: 31, label: 'Declaración Anual ISR', type: 'isr', note: '31 Marzo' },
];

const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    iva:       { bg: 'bg-slate-50',    text: 'text-black',   dot: 'bg-blue-600',   label: 'IVA' },
    igss:      { bg: 'bg-slate-50',    text: 'text-black',   dot: 'bg-emerald-600',label: 'IGSS / Planilla' },
    isr:       { bg: 'bg-slate-50',    text: 'text-black',   dot: 'bg-orange-600', label: 'ISR' },
    prestacion:{ bg: 'bg-slate-50',    text: 'text-black',   dot: 'bg-purple-600', label: 'Prestaciones' },
};

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const TabCalendarioFiscal: React.FC<{ accentColor: string; onNavigate: (tab: string) => void }> = ({ accentColor, onNavigate }) => {
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const today = dayjs();

    // Build all events for the year
    const allEvents: { date: dayjs.Dayjs; event: CalEvent & { annual?: boolean; quarterly?: boolean } }[] = [];

    // Recurring monthly
    for (let m = 0; m < 12; m++) {
        RECURRING.forEach(ev => {
            const d = dayjs(`${viewYear}-${String(m + 1).padStart(2, '0')}-${String(ev.day).padStart(2, '0')}`);
            if (d.isValid()) allEvents.push({ date: d, event: ev });
        });
    }

    // Quarterly
    QUARTERLY.forEach(q => {
        const m = q.month === 0 ? 0 : q.month;
        const y = q.month === 0 ? viewYear + 1 : viewYear;
        const lastDay = dayjs(`${y}-${String(m + 1).padStart(2, '0')}-01`).endOf('month').date();
        const d = dayjs(`${y}-${String(m + 1).padStart(2, '0')}-${Math.min(q.day, lastDay)}`);
        if (d.year() === viewYear) allEvents.push({ date: d, event: { day: d.date(), months: [], label: q.label, type: 'isr', tabId: 'isr', quarterly: true } });
    });

    // Annual
    ANNUAL.forEach(a => {
        const lastDay = dayjs(`${viewYear}-${String(a.month + 1).padStart(2, '0')}-01`).endOf('month').date();
        const d = dayjs(`${viewYear}-${String(a.month + 1).padStart(2, '0')}-${Math.min(a.day, lastDay)}`);
        if (d.isValid()) allEvents.push({ date: d, event: { day: d.date(), months: [], label: a.label, type: a.type, annual: true } });
    });

    allEvents.sort((a, b) => a.date.valueOf() - b.date.valueOf());

    // Next upcoming
    const upcoming = allEvents.filter(e => e.date.isAfter(today)).slice(0, 5);

    // Days until
    const daysUntil = (d: dayjs.Dayjs) => d.diff(today, 'day');

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Year selector */}
            <div className="flex items-center gap-3">
                <label className="text-[10px] font-semibold uppercase text-black tracking-widest">Año:</label>
                <button onClick={() => setViewYear(y => y - 1)} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] hover:bg-slate-50">◀</button>
                <span className="text-[14px] font-semibold text-[#106ebe] w-14 text-center">{viewYear}</span>
                <button onClick={() => setViewYear(y => y + 1)} className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] hover:bg-slate-50">▶</button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                {Object.entries(TYPE_STYLES).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${v.dot}`}></span>
                        <span className="text-[9px] font-semibold uppercase text-black">{v.label}</span>
                    </div>
                ))}
            </div>

            {/* Próximas obligaciones */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <h3 className="text-[10px] font-semibold uppercase text-black tracking-widest mb-3">Próximas Obligaciones</h3>
                <div className="space-y-2">
                    {upcoming.map((u, i) => {
                        const days = daysUntil(u.date);
                        const st = TYPE_STYLES[u.event.type];
                        return (
                            <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${st.bg} cursor-pointer hover:opacity-80 transition-opacity`}
                                onClick={() => u.event.tabId && onNavigate(u.event.tabId)}>
                                <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`}></span>
                                <div className="flex-1">
                                    <p className={`text-[10px] font-semibold text-black`}>{u.event.label}</p>
                                    <p className="text-[9px] font-semibold text-black">{u.date.format('DD/MM/YYYY')}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${days <= 5 ? 'bg-red-100 text-black' : days <= 10 ? 'bg-amber-100 text-black' : 'bg-slate-100 text-black'}`}>
                                    {days === 0 ? '¡Hoy!' : `${days} días`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Calendar grid by month */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {MONTHS.map((mName, mi) => {
                    const monthEvents = allEvents.filter(e => e.date.month() === mi && e.date.year() === viewYear);
                    if (monthEvents.length === 0) return null;
                    return (
                        <div key={mi} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-[#106ebe] px-4 py-2">
                                <span className="text-[10px] font-semibold text-white uppercase tracking-widest">{mName} {viewYear}</span>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {monthEvents.map((e, ei) => {
                                    const st = TYPE_STYLES[e.event.type];
                                    const days = daysUntil(e.date);
                                    const isPast = e.date.isBefore(today);
                                    const isClose = !isPast && days <= 5;
                                    return (
                                        <div key={ei}
                                            className={`flex items-start gap-2 p-2 rounded-lg text-[9px] cursor-pointer hover:opacity-80 transition-opacity ${st.bg} ${isClose ? 'ring-1 ring-red-400' : ''}`}
                                            onClick={() => e.event.tabId && onNavigate(e.event.tabId)}>
                                            <div className="flex flex-col items-center shrink-0 mt-0.5">
                                                <span className={`text-[14px] font-semibold leading-none text-black`}>{e.date.date()}</span>
                                                <span className={`${st.dot} w-1.5 h-1.5 rounded-full mt-0.5`}></span>
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-semibold text-black leading-tight`}>{e.event.label}</p>
                                                {e.event.note && <p className="text-black font-medium mt-0.5">{e.event.note}</p>}
                                                {!isPast && <p className={`mt-0.5 font-semibold ${isClose ? 'text-red-600' : 'text-black'}`}>{days === 0 ? '¡Hoy!' : `${days} días`}</p>}
                                                {isPast && <p className="mt-0.5 font-semibold text-slate-400">Pasado</p>}
                                            </div>
                                            {e.event.quarterly && <span className="px-1 py-0.5 bg-red-200 text-red-800 text-[7px] font-semibold uppercase rounded">Trimestral</span>}
                                            {e.event.annual && <span className="px-1 py-0.5 bg-purple-200 text-purple-800 text-[7px] font-semibold uppercase rounded">Anual</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
