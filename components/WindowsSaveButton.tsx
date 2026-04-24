import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
    onClick: () => void;
    loading?: boolean;
    className?: string;
    title?: string;
    size?: number;
    variant?: 'default' | 'minimal';
}

export const WindowsSaveButton: React.FC<Props> = ({
    onClick,
    loading = false,
    className,
    title = "Guardar",
    size = 16,
    variant = 'default'
}) => {
    const defaultClassName = variant === 'minimal'
        ? "w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded active:scale-95 transition-all text-white"
        : "p-1.5 hover:bg-white/10 rounded active:scale-95 transition-all text-white";

    const finalClassName = className || defaultClassName;

    return (
        <button onClick={onClick} className={finalClassName} title={title}>
            {loading ? (
                <Loader2 className="animate-spin" size={size} />
            ) : (
                <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                    <path fillRule="evenodd" clipRule="evenodd" d="M2 1H11L15 5V15H2V1Z" fill="url(#floppyGrad)" />
                    <rect x="4" y="1" width="7" height="6" fill="url(#metalGrad)" />
                    <rect x="5" y="2" width="2" height="4" fill="#444" />
                    <rect x="3" y="9" width="10" height="6" fill="#fcfcfc" />
                    <rect x="4" y="10" width="8" height="1" fill="#d1d1d1" />
                    <rect x="4" y="12" width="8" height="1" fill="#d1d1d1" />
                    <defs>
                        <linearGradient id="floppyGrad" x1="2" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#969696" />
                            <stop offset="1" stopColor="#5c5c5c" />
                        </linearGradient>
                        <linearGradient id="metalGrad" x1="4" y1="1" x2="11" y2="7" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ffffff" />
                            <stop offset="1" stopColor="#c4c4c4" />
                        </linearGradient>
                    </defs>
                </svg>
            )}
        </button>
    );
};
