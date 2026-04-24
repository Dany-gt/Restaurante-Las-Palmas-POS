import React from 'react';

export const VerifiedScooterIcon: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {/* Box on back */}
        <rect x="2.5" y="6" width="4.5" height="7.5" rx="0.5" />

        {/* Rider Head */}
        <circle cx="10.5" cy="5.5" r="1.5" />

        {/* Rider Back/Seat */}
        <path d="M 10 7.5 C 9 9 7 11 7 13 L 9.5 13 L 11.5 14 L 11.5 16.5" />

        {/* Rider Arm */}
        <path d="M 9.5 8.5 L 14.5 11" />

        {/* Steering column */}
        <path d="M 16 16.5 L 13.5 10.5 L 12.5 9.5" />

        {/* Fenders and Base */}
        {/* Back Wheel Fender => Base => Front Wheel Fender */}
        <path d="M 2.5 16.5 A 3.5 3.5 0 0 1 9.5 16.5 H 12.5 A 3.5 3.5 0 0 1 19.5 16.5" />
        <path d="M 19.5 16.5 L 21 16" /> {/* Small back flap? */}

        {/* Wheels */}
        <circle cx="6" cy="17.5" r="2.2" />
        <circle cx="16" cy="17.5" r="2.2" />

        {/* Checkmark */}
        <path d="M 15.5 8 L 17.5 10 L 22.5 5" />
    </svg>
);

export const UnverifiedScooterIcon: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {/* Box on back */}
        <rect x="2.5" y="6" width="4.5" height="7.5" rx="0.5" />

        {/* Rider Head */}
        <circle cx="10.5" cy="5.5" r="1.5" />

        {/* Rider Back/Seat */}
        <path d="M 10 7.5 C 9 9 7 11 7 13 L 9.5 13 L 11.5 14 L 11.5 16.5" />

        {/* Rider Arm */}
        <path d="M 9.5 8.5 L 14.5 11" />

        {/* Steering column */}
        <path d="M 16 16.5 L 13.5 10.5 L 12.5 9.5" />

        {/* Fenders and Base */}
        <path d="M 2.5 16.5 A 3.5 3.5 0 0 1 9.5 16.5 H 12.5 A 3.5 3.5 0 0 1 19.5 16.5" />
        <path d="M 19.5 16.5 L 21 16" />

        {/* Wheels */}
        <circle cx="6" cy="17.5" r="2.2" />
        <circle cx="16" cy="17.5" r="2.2" />

        {/* X Mark */}
        <path d="M 17 5 L 21 9 M 21 5 L 17 9" />
    </svg>
);
