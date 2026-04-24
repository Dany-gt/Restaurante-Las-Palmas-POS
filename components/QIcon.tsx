import React from 'react';

interface QIconProps {
    size?: number | string;
    className?: string;
}

export const QIcon: React.FC<QIconProps> = ({ size = 24, className = '' }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`lucide ${className}`}
        >
            <circle cx="12" cy="12" r="8" />
            <line x1="16" y1="16" x2="20" y2="20" />
        </svg>
    );
};
