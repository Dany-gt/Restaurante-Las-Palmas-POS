import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Colección de Iconos Estilo "Páladar Flat Business" recreados en SVG
 */

// 1. Mis Repartidores (Mapa con Pin)
export const IconRepartidores: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Mapa Plegado */}
    <path d="M4 6L11 4V26L4 28V6Z" fill="#B0BEC5" />
    <path d="M11 4L21 7V29L11 26V4Z" fill="#90A4AE" />
    <path d="M21 7L28 5V27L21 29V7Z" fill="#78909C" />
    {/* Pin de Ubicación */}
    <path d="M16 8C14.3431 8 13 9.34315 13 11C13 13.5 16 17 16 17C16 17 19 13.5 19 11C19 9.34315 17.6569 8 16 8Z" fill="#F44336" />
    <circle cx="16" cy="11" r="1.5" fill="white" />
  </svg>
);

// 2. Plataformas de Pedidos (Nodos Conectados)
export const IconPlataformas: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="16" cy="8" r="4" fill="#1976D2" />
    <circle cx="8" cy="22" r="4" fill="#1976D2" />
    <circle cx="24" cy="22" r="4" fill="#1976D2" />
    <line x1="16" y1="8" x2="8" y2="22" stroke="#1976D2" strokeWidth="2" />
    <line x1="16" y1="8" x2="24" y2="22" stroke="#1976D2" strokeWidth="2" />
    <line x1="8" y1="22" x2="24" y2="22" stroke="#1976D2" strokeWidth="2" />
  </svg>
);

// 3. Estaciones de Meseros (Rectángulo con barra azul)
export const IconEstaciones: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="6" y="8" width="20" height="16" rx="1" fill="#ECEFF1" stroke="#455A64" strokeWidth="1.5" />
    <rect x="20" y="8" width="6" height="16" fill="#1976D2" />
  </svg>
);

// 4. Tipos de Descuento (Caja con % y Flecha)
export const IconDescuentos: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="6" y="6" width="20" height="20" rx="1" fill="#1976D2" />
    <path d="M12 20L12 12M12 12L9 15M12 12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <text x="17" y="21" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">%</text>
  </svg>
);

// 5. Puntos de Impresión (Rejilla con impresora)
export const IconPuntosImpresion: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Rejilla de fondo */}
    <rect x="6" y="6" width="6" height="6" fill="#CFD8DC" />
    <rect x="13" y="6" width="6" height="6" fill="#90A4AE" />
    <rect x="20" y="6" width="6" height="6" fill="#CFD8DC" />
    <rect x="6" y="13" width="6" height="6" fill="#90A4AE" />
    <rect x="13" y="13" width="6" height="6" fill="#CFD8DC" />
    <rect x="20" y="13" width="6" height="6" fill="#90A4AE" />
    {/* Icono impresora superpuesto */}
    <rect x="12" y="18" width="14" height="10" rx="1" fill="#455A64" />
    <rect x="15" y="22" width="8" height="6" fill="white" />
  </svg>
);

// 6. Cuentas por Cobrar (Rejilla con %)
export const IconCuentas: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="6" y="6" width="6" height="6" fill="#CFD8DC" />
    <rect x="13" y="6" width="6" height="6" fill="#CFD8DC" />
    <rect x="20" y="6" width="6" height="6" fill="#CFD8DC" />
    <rect x="6" y="13" width="6" height="6" fill="#CFD8DC" />
    <rect x="13" y="13" width="6" height="6" fill="#CFD8DC" />
    <rect x="20" y="13" width="6" height="6" fill="#CFD8DC" />
    <rect x="6" y="20" width="6" height="6" fill="#CFD8DC" />
    <rect x="13" y="20" width="6" height="6" fill="#CFD8DC" />
    <rect x="20" y="20" width="6" height="6" fill="#CFD8DC" />
    <text x="11" y="20" fill="#455A64" fontSize="12" fontWeight="bold" fontFamily="Arial">%</text>
  </svg>
);

// 7. Gastos y Categorías (Lista / Checklist)
export const IconGastos: React.FC<IconProps> = ({ size = 32, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="8" y="6" width="16" height="20" rx="1" fill="#ECEFF1" stroke="#455A64" strokeWidth="1.5" />
    <line x1="12" y1="10" x2="20" y2="10" stroke="#1976D2" strokeWidth="2" />
    <line x1="12" y1="16" x2="20" y2="16" stroke="#455A64" strokeWidth="2" />
    <line x1="12" y1="22" x2="20" y2="22" stroke="#455A64" strokeWidth="2" />
  </svg>
);
