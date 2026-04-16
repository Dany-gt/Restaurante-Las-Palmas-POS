import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export interface DomainCategory {
    id: string;
    nombre: string;       // campo normalizado — siempre disponible
    parent_id?: string | null;
    sort_order?: number;
    activo?: boolean;
}

interface UseDomainCategoriesOptions {
    table: string;
    extraFilters?: Record<string, any>;
    orderBy?: string;
    /**
     * Nombre real de la columna de texto en BD.
     * menu_categories     → 'nombre'
     * product_categories  → 'nombre'
     * supply_categories   → 'name'   ← ya existe con este esquema
     * utensil_categories  → 'name'   ← ya existe con este esquema
     */
    nameField?: 'nombre' | 'name';
}

export function useDomainCategories({
    table,
    extraFilters = {},
    orderBy = 'sort_order',
    nameField = 'nombre',
}: UseDomainCategoriesOptions) {
    const [categories, setCategories] = useState<DomainCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase.from(table).select('*').order(orderBy);
        Object.entries(extraFilters).forEach(([k, v]) => { q = q.eq(k, v); });
        const { data, error } = await q;
        if (!error && data) {
            // Normalizar: mapear nameField → nombre para uso uniforme en UI
            const normalized = (data as any[]).map(row => ({
                ...row,
                nombre: row[nameField] ?? row['nombre'] ?? '',   // preferir el campo real
            })) as DomainCategory[];
            setCategories(normalized);
        }
        setLoading(false);
    }, [table, orderBy, nameField]);     // nameField como dependencia

    useEffect(() => { load(); }, [load]);

    const create = useCallback(async (nombre: string, extra: Record<string, any> = {}) => {
        const nombre_upper = nombre.toUpperCase();
        // Insertar con el nombre de columna correcto
        const payload: Record<string, any> = {
            [nameField]: nombre_upper,
            ...extra,
        };
        // Si la tabla usa 'nombre' internamente también ponerlo
        if (nameField === 'name') {
            // no necesita 'nombre'
        }
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        await load();
    }, [table, load, nameField]);

    const update = useCallback(async (id: string, data: Record<string, any>) => {
        // Si vienen con 'nombre' normalizado, re-mapear al campo real
        const payload = { ...data };
        if ('nombre' in payload && nameField !== 'nombre') {
            payload[nameField] = payload['nombre'];
            delete payload['nombre'];
        }
        const { error } = await supabase.from(table).update(payload).eq('id', id);
        if (error) throw error;
        await load();
    }, [table, load, nameField]);

    const remove = useCallback(async (id: string) => {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        await load();
    }, [table, load]);

    return { categories, loading, load, create, update, remove };
}
