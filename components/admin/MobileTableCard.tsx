import React from 'react';

interface DetailField {
    label: string;
    value: string | number;
    color?: string;
}

interface MobileTableCardProps {
    title: string;
    value: string | number;
    details: DetailField[];
    hasActivity?: boolean;
    onClick?: () => void;
}

/**
 * MobileTableCard - Componente para sustituir filas de tablas en pantallas móviles.
 * Sigue la estética "Fintech Indigo" del ecosistema Las Palmas.
 */
export const MobileTableCard: React.FC<MobileTableCardProps> = ({
    title,
    value,
    details,
    hasActivity = false,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                relative bg-white border border-slate-100 rounded-[8px] shadow-sm 
                p-4 mb-3 transition-all active:scale-[0.98] 
                ${onClick ? 'cursor-pointer' : ''}
                ${hasActivity ? 'border-l-[4px] border-l-emerald-500' : ''}
            `}
        >
            {/* Header Section */}
            <div className="flex justify-between items-start mb-3">
                <h4 className="text-[13px] font-medium text-slate-800 uppercase tracking-tight truncate max-w-[60%]">
                    {title}
                </h4>
                <span className="text-[14px] font-semibold text-[#4f46e5] tabular-nums">
                    {value}
                </span>
            </div>

            {/* Body Grid (2 columns) */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {details.map((field, idx) => (
                    <div key={idx} className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mb-1">
                            {field.label}
                        </span>
                        <span className={`text-[12px] font-medium ${field.color || 'text-slate-700'} tabular-nums`}>
                            {field.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MobileTableCard;
