/**
 * Archivo: utils/isoCalculator.ts
 * Lógica oficial del Impuesto de Solidaridad (ISO) en Guatemala
 */

export interface ISOCalculation {
  baseUtilizada: 'Ingresos Brutos' | 'Activo Neto';
  montoBase: number;
  impuestoAnualTotal: number;
  pagoTrimestral: number;
}

/**
 * Calcula el ISO trimestral basándose en el mayor entre Ingresos Brutos y Activo Neto.
 * @param ingresosBrutosAnuales Ingresos brutos del periodo fiscal anterior.
 * @param activoNetoAnual Activo neto del periodo fiscal anterior.
 */
export function calcularISOTrimestral(ingresosBrutosAnuales: number, activoNetoAnual: number): ISOCalculation {
  // 1. La ley manda a tomar el monto mayor entre los Ingresos y el Activo
  const baseCalculo = Math.max(ingresosBrutosAnuales, activoNetoAnual);
  
  // 2. La tasa del ISO en Guatemala es del 1%
  const TASA_ISO = 0.01;
  const impuestoAnual = baseCalculo * TASA_ISO;
  
  // 3. Se divide en 4 pagos (Ene-Mar, Abr-Jun, Jul-Sep, Oct-Dic)
  const pagoTrimestral = impuestoAnual / 4;

  // Redondeo a 2 decimales para exactitud con Declaraguate
  const round = (num: number) => Math.round(num * 100) / 100;

  return {
    baseUtilizada: baseCalculo === ingresosBrutosAnuales ? 'Ingresos Brutos' : 'Activo Neto',
    montoBase: round(baseCalculo),
    impuestoAnualTotal: round(impuestoAnual),
    pagoTrimestral: round(pagoTrimestral) // Genera el monto exacto para la boleta
  };
}
