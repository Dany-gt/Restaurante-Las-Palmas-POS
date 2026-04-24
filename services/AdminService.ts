import { supabase } from '../supabase';

/**
 * AdminService.ts
 * Implementación de lógica administrativa para multisucursal
 */

/**
 * Genera un token alfanumérico aleatorio para la licencia de sucursal
 */
const generateBranchToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitando O, 0, I, 1 por legibilidad
    let token = '';
    for (let i = 0; i < 8; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

/**
 * Crea una nueva organización (Empresa) junto con su sucursal matriz y administrador inicial
 */
export const createNewOrganization = async (orgName: string, adminEmail?: string, adminName?: string) => {
    try {
        const branchToken = generateBranchToken();

        // 1. Crear la Organización
        const { data: newOrg, error: orgError } = await supabase
            .from('organizations')
            .insert([{ name: orgName.toUpperCase(), status: 'active' }])
            .select()
            .single();

        if (orgError) throw orgError;

        // 2. Crear la Sucursal Matriz por defecto con TOKEN
        const { data: mainBranch, error: branchError } = await supabase
            .from('branches')
            .insert([{
                name: "MATRIZ " + orgName.toUpperCase(),
                location: "MATRIZ",
                is_main: true,
                org_id: newOrg.id,
                registration_token: branchToken // Este campo debe existir en la tabla o lo manejará Supabase
            }])
            .select()
            .single();

        if (branchError) console.warn("Error al crear sucursal matriz:", branchError.message);

        // 3. Crear el Perfil del Administrador si se proporcionó
        if (adminEmail && adminName && mainBranch) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    name: adminName.toUpperCase(),
                    email: adminEmail.toLowerCase(),
                    role: 'ADMIN',
                    org_id: newOrg.id,
                    branch_id: mainBranch.id,
                    is_active: true
                }]);

            if (profileError) console.warn("Error al crear perfil de admin:", profileError.message);
        }

        return { success: true, orgId: newOrg.id, name: newOrg.name, token: branchToken };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

/**
 * Obtiene todas las organizaciones (Solo para SuperAdmin)
 */
export const getOrganizations = async () => {
    try {
        const { data, error } = await supabase.from('organizations').select('*').order('name');
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const createNewBranch = async (
    branchName: string,
    location: string,
    adminEmail?: string,
    adminName?: string,
    orgId?: string // Link to organization
) => {
    try {
        const branchToken = generateBranchToken();

        // 1. Crear la sucursal con TOKEN
        const { data: newBranch, error: branchError } = await supabase
            .from('branches')
            .insert([{
                name: branchName.toUpperCase(),
                location: location,
                is_main: false,
                email: adminEmail,
                enable_billing: false,
                org_id: orgId, // Multi-tenant isolation
                registration_token: branchToken
            }])
            .select()
            .single();

        if (branchError) throw branchError;

        // 2. Crear el perfil inicial si se proporcionó información de admin
        if (adminEmail && adminName) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    name: adminName.toUpperCase(),
                    email: adminEmail,
                    role: 'ADMIN',
                    branch_id: newBranch.id,
                    org_id: orgId, // Assign to the same organization
                    is_active: true
                }]);

            if (profileError) console.warn("Aviso: No se pudo crear el perfil automático:", profileError.message);
        }

        return {
            success: true,
            branchId: newBranch.id,
            token: branchToken,
            message: "La sucursal se ha creado y está lista para ser configurada desde cero con su nuevo administrador."
        };

    } catch (error: any) {
        console.error("Error al crear sucursal:", error);
        return { success: false, error: error.message };
    }
};
