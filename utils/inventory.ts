
/**
 * Utilidad de conversión de unidades para el sistema de inventario.
 * Proporciona factores de conversión estandarizados para Volumen, Masa y Conteo.
 */

export interface InventoryUnit {
    code: string;
    name: string;
    category: 'Volumen' | 'Masa' | 'Conteo';
    base_unit: string;
    factor: number;
}

export const INVENTORY_UNITS: Record<string, InventoryUnit> = {
    // Volumen (Base: ML)
    'ML': { code: 'ML', name: 'Mililitros', category: 'Volumen', base_unit: 'ML', factor: 1 },
    'LT': { code: 'LT', name: 'Litros', category: 'Volumen', base_unit: 'ML', factor: 1000 },
    'FL OZ': { code: 'FL OZ', name: 'Onzas Líquidas', category: 'Volumen', base_unit: 'ML', factor: 29.5735 },
    'GL': { code: 'GL', name: 'Galones', category: 'Volumen', base_unit: 'ML', factor: 3785.41 },

    // Masa (Base: GR)
    'GR': { code: 'GR', name: 'Gramos', category: 'Masa', base_unit: 'GR', factor: 1 },
    'MG': { code: 'MG', name: 'Miligramos', category: 'Masa', base_unit: 'GR', factor: 0.001 },
    'KG': { code: 'KG', name: 'Kilogramos', category: 'Masa', base_unit: 'GR', factor: 1000 },
    'LB': { code: 'LB', name: 'Libras', category: 'Masa', base_unit: 'GR', factor: 453.592 },
    'OZ': { code: 'OZ', name: 'Onzas', category: 'Masa', base_unit: 'GR', factor: 28.3495 },

    // Conteo (Base: UN)
    'UN': { code: 'UN', name: 'Unidades', category: 'Conteo', base_unit: 'UN', factor: 1 },
    'POR': { code: 'POR', name: 'Porciones', category: 'Conteo', base_unit: 'UN', factor: 1 },
    'CAJA': { code: 'CAJA', name: 'Cajas', category: 'Conteo', base_unit: 'UN', factor: 1 },
    'BOLSA': { code: 'BOLSA', name: 'Bolsas', category: 'Conteo', base_unit: 'UN', factor: 1 },
};

/**
 * Convierte una cantidad de una unidad a otra, siempre que pertenezcan a la misma categoría.
 */
export const convertInventoryQuantity = (quantity: number, fromUnitCode: string, toUnitCode: string): number => {
    if (!fromUnitCode || !toUnitCode) return quantity;

    const from = INVENTORY_UNITS[fromUnitCode.toUpperCase().trim()];
    const to = INVENTORY_UNITS[toUnitCode.toUpperCase().trim()];

    if (!from || !to || from.category !== to.category) {
        return quantity; // Unidades no compatibles o desconocidas
    }

    // Normalizar a la unidad base (ML, GR, UN) y luego convertir a la unidad destino
    const baseQuantity = quantity * from.factor;
    const finalQuantity = baseQuantity / to.factor;

    return parseFloat(finalQuantity.toFixed(4));
};

/**
 * Devuelve el factor de una unidad respecto a su base.
 */
export const getUnitFactor = (unitCode: string): number => {
    const unit = INVENTORY_UNITS[unitCode.toUpperCase().trim()];
    return unit ? unit.factor : 1;
};
