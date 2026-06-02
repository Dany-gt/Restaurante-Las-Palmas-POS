/**
 * useModulePermissions
 * =====================
 * Centralized hook to check granular sub-action permissions within admin modules.
 * 
 * Usage inside any admin component:
 *   const { can } = useModulePermissions('Usuarios');
 *   if (can('Nuevo')) { ... }   // → checks "Usuarios:Nuevo"
 *   if (can('Eliminar')) { ... } // → checks "Usuarios:Eliminar"
 * 
 * ADMIN role always bypasses all checks (returns true).
 * Permission strings are case-insensitive.
 */

import { useMemo } from 'react';
import { User } from '../types';

/**
 * Reads currentUser from localStorage.
 * Admin components don't receive currentUser as a prop — they read from cache.
 */
const getCurrentUser = (): User | null => {
    try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

/**
 * Hook: useModulePermissions
 * @param moduleName - The module name exactly as defined in permissions.ts (e.g. "Usuarios", "Platillos y Bebidas")
 */
export const useModulePermissions = (moduleName: string) => {
    const currentUser = getCurrentUser();

    const can = useMemo(() => {
        return (action: string): boolean => {
            if (!currentUser) return false;

            // ADMIN role bypasses all checks — always full access
            if (currentUser.role?.toUpperCase() === 'ADMIN') return true;

            // Original role (for operator-dashboard elevated sessions) also bypasses
            if ((currentUser as any).originalRole?.toUpperCase() === 'ADMIN') return true;

            const requiredPerm = `${moduleName}:${action}`.toLowerCase().trim();
            const userPerms = (currentUser.permissions || []).map(p => p.toLowerCase().trim());

            return userPerms.includes(requiredPerm);
        };
    }, [currentUser, moduleName]);

    /**
     * Returns true if the user has AT LEAST ONE of the given actions.
     * Useful for showing/hiding a toolbar button that covers multiple actions.
     */
    const canAny = useMemo(() => {
        return (...actions: string[]): boolean => {
            return actions.some(action => can(action));
        };
    }, [can]);

    /**
     * Returns true if the user has the full :Acceso permission for this module.
     * Useful for top-level module guard.
     */
    const hasAccess = can('Acceso');

    return { can, canAny, hasAccess };
};
