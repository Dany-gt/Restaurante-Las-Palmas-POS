import React from 'react';

// ─── Paths del cuerpo principal del scooter de entrega ─────────────────────
// viewBox 0 0 64 64 — SVG original provisto por el usuario
const ScooterPaths = () => (
    <>
        {/* Cuerpo principal del scooter + detalles */}
        <path d="M59.36 46.63a9.022 9.022 0 0 0-5.16-2.55l-1.06-3.38-1.91.6 2.09 6.69a2.969 2.969 0 0 1-.74 3.01l-2.99 3H48v-2.84l1.95-5.84a1.055 1.055 0 0 0 .03-.5L48.2 35h1.06l1.35 4.3 1.91-.6-1.16-3.7H53a2.006 2.006 0 0 0 2-2v-3.72a2 2 0 0 0-2.49-1.94L45.88 29h-5.12l-1.16-4.06A4.993 4.993 0 0 0 44 20v-2h.92a1 1 0 0 0 .99-1.14 8 8 0 1 0-14.32 5.93 8.029 8.029 0 0 0 .87.97l-1.47 2.55A15.177 15.177 0 0 0 29 33.75V36h-1.18a3 3 0 0 0 .18-1V21h-2v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2H4v2a3.009 3.009 0 0 0 3 3h9.18A2.98 2.98 0 0 0 19 42h2.68a11 11 0 0 0-4.64 8H12v2h4.99l-.01 3a.99.99 0 0 0 1 1H21a6 6 0 0 0 12 0h16a6.009 6.009 0 0 0 6 6 6 6 0 0 0 6-6 5.845 5.845 0 0 0-.35-2H61a1 1 0 0 0 1-1 8.941 8.941 0 0 0-2.64-6.37zM53 29.28V33h-4.18a2.924 2.924 0 0 0-.29-2.6zM44 31h2a1 1 0 0 1 0 2h-2.01zm-4 0h2l-.01 2h-3.58l-3.16-3.16a1.124 1.124 0 1 1 1.59-1.59l2.45 2.46A1.033 1.033 0 0 0 40 31zm2-11a3.009 3.009 0 0 1-3 3h-1v-5h1v2h2v-2h1zm-9.93-2.91a6.05 6.05 0 0 1 5.02-5.02A5.5 5.5 0 0 1 38 12a5.973 5.973 0 0 1 5.65 4H37a1 1 0 0 0-1 1v6.65a5.908 5.908 0 0 1-2.81-2.06 5.984 5.984 0 0 1-1.12-4.5zM31 33.76a13.21 13.21 0 0 1 1.73-6.46l1.34-2.34a7.89 7.89 0 0 0 2.79.95.66.66 0 0 0 .14.01 1.023 1.023 0 0 0 .66-.25c.02-.02.03-.05.05-.07l.29 1.03a3.112 3.112 0 0 0-4.16 4.62l3.19 3.2-.67 1.55H31zM19 40a1 1 0 0 1 0-2h10v1a3 3 0 0 0 .18 1zm8 20a4 4 0 0 1-4-4h3v1h2v-1h3a4 4 0 0 1-4 4zm10-6H23v-2h14zm0-8h-7v2h7v2H23.18A3.01 3.01 0 0 1 26 48h2v-2h-2a5 5 0 0 0-5 5v3h-2.02l.01-3.01a9.005 9.005 0 0 1 9-8.99H37zm0-6h-5a1 1 0 0 1-1-1v-1h7a3.009 3.009 0 0 1 3 3v5h-2v-4a2.006 2.006 0 0 0-2-2zm5 8a1 1 0 0 1 1 1v1h-4v-2zm4 6h-7v-2h7zm.28-4H45v-1a3.014 3.014 0 0 0-2-2.83V41a5 5 0 0 0-4.48-4.95l.45-1.05h7.2l1.8 9.93zM55 60a4 4 0 0 1-4-4 4.452 4.452 0 0 1 .07-.66L52.41 54h6.05a3.944 3.944 0 0 1 .54 2 4 4 0 0 1-4 4zm-.64-8a4.993 4.993 0 0 0 .87-4.61l-.35-1.13A6.957 6.957 0 0 1 59.93 52z" fill="currentColor" />
        <path d="M54 55h2v2h-2zM6 17a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2h2v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v14h2zM6 54h9v2H6zM2 54h2v2H2zM14 58h6v2h-6zM10 58h2v2h-2zM8 50h2v2H8zM6 58h2v2H6zM12 4h9v2h-9zM8 4h2v2H8zM20 8h6v2h-6zM16 8h2v2h-2zM12 8h2v2h-2z" fill="currentColor" />
    </>
);

// ─── VerifiedScooterIcon — Scooter + Escudo con ✓ ──────────────────────────
export const VerifiedScooterIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = '',
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
    >
        {/* Escudo con checkmark */}
        <path d="M10 18a1 1 0 0 0-1 1v7.859a4.992 4.992 0 0 0 2.227 4.161l4.218 2.812a1 1 0 0 0 1.11 0l4.218-2.812A4.992 4.992 0 0 0 23 26.859V19a1 1 0 0 0-1-1zm11 8.859a2.993 2.993 0 0 1-1.336 2.5L16 31.8l-3.664-2.443A2.993 2.993 0 0 1 11 26.859V20h10z" fill="currentColor" />
        <path d="M15 28a1 1 0 0 0 .707-.293l4-4-1.414-1.414L15 25.586l-1.293-1.293-1.414 1.414 2 2A1 1 0 0 0 15 28z" fill="currentColor" />
        {/* Cuerpo del scooter */}
        <ScooterPaths />
    </svg>
);

// ─── UnverifiedScooterIcon — Scooter + Escudo con ✗ ────────────────────────
export const UnverifiedScooterIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = '',
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
    >
        {/* Escudo (sin checkmark) */}
        <path d="M10 18a1 1 0 0 0-1 1v7.859a4.992 4.992 0 0 0 2.227 4.161l4.218 2.812a1 1 0 0 0 1.11 0l4.218-2.812A4.992 4.992 0 0 0 23 26.859V19a1 1 0 0 0-1-1zm11 8.859a2.993 2.993 0 0 1-1.336 2.5L16 31.8l-3.664-2.443A2.993 2.993 0 0 1 11 26.859V20h10z" fill="currentColor" />
        {/* X mark dentro del escudo */}
        <path d="M13 22l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Cuerpo del scooter */}
        <ScooterPaths />
    </svg>
);

// ─── ScooterIcon — Solo el scooter, sin escudo ──────────────────────────────
export const ScooterIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = '',
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
    >
        <ScooterPaths />
    </svg>
);
