/**
 * Archivo: utils/igssCalculator.ts
 * Lógica oficial de IGSS para Guatemala
 */

export interface IGSSCalculation {
  salarioBase: number;
  cuotaLaboral: number;
  cuotaPatronalIGSS: number;
  cuotaPatronalINTECAP: number;
  cuotaPatronalIRTRA: number;
  totalPatrono: number;
}

/**
 * Calcula todos los impuestos laborales y patronales vigentes en Guatemala.
 * @param salarioDevengado El salario real ganado por el empleado en el periodo.
 * @param salarioMinimoEfectivo El techo mínimo sobre el cual el IGSS cobra si el salario es menor.
 */
export function calcularImpuestosLaborales(salarioDevengado: number, salarioMinimoEfectivo: number): IGSSCalculation {
  // Tasas oficiales de Guatemala
  const TASA_LABORAL = 0.0483;         // 4.83%
  const TASA_PATRONAL_IGSS = 0.1067;   // 10.67%
  const TASA_INTECAP = 0.01;           // 1.00%
  const TASA_IRTRA = 0.01;             // 1.00%

  // El IGSS siempre cobra sobre una base mínima si el devengado es menor o cero
  const baseCalculo = salarioDevengado > 0 ? salarioDevengado : salarioMinimoEfectivo;

  // Redondeo a 2 decimales para precisión contable
  const round = (num: number) => Math.round(num * 100) / 100;

  const cuotaLaboral = round(baseCalculo * TASA_LABORAL);
  const cuotaPatronalIGSS = round(baseCalculo * TASA_PATRONAL_IGSS);
  const cuotaPatronalINTECAP = round(baseCalculo * TASA_INTECAP);
  const cuotaPatronalIRTRA = round(baseCalculo * TASA_IRTRA);

  const totalPatrono = round(cuotaPatronalIGSS + cuotaPatronalINTECAP + cuotaPatronalIRTRA);

  return {
    salarioBase: baseCalculo,
    cuotaLaboral, // Lo que restas en el recibo de pago
    cuotaPatronalIGSS,
    cuotaPatronalINTECAP,
    cuotaPatronalIRTRA,
    totalPatrono // Lo que asume Restaurante Las Palmas como gasto
  };
}
