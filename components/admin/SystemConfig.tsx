import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { removeBackground } from '@imgly/background-removal';
import { Settings2, X, Building2, Loader2, Globe, Mail, Layers, Cpu, MousePointer2, Baseline, Monitor } from 'lucide-react';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { activityLogService } from '../../services/ActivityLogService';
import packageJson from '../../package.json';
export const SystemConfig: React.FC<{
    onClose?: () => void;
    onThemeChange?: (theme: string) => void;
    currentTheme?: string;
}> = ({ onClose, onThemeChange, currentTheme }) => {
    const [config, setConfig] = useState({
        restaurant_name: 'RESTAURANTE LAS PALMAS POS',
        address: '',
        phone: '',
        email: '',
        website: '',
        currency: 'Q.',
        tax_percentage: '12',
        opening_hours: '08:00 - 22:00',
        logo_url: '',
        login_background_url: '',
        // SMTP settings
        smtp_host: '',
        smtp_port: '',
        smtp_user: '',
        smtp_pass: '',
        // New operational settings
        cashier_emails: '',
        enable_general_kitchen: false,
        suggested_tip: '10',
        round_tip: true,
        enable_quick_sale: true,
        limit_order_access: true,
        print_expense_ticket: true,
        print_order_num_ticket: true,
        print_charge_ticket: false,
        print_cancelled_ticket: true,
        print_deleted_ticket: true,
        allow_close_with_open_orders: false,
        allow_close_with_cashier_orders: true,
        multi_cashier_register: false,
        require_pin_for_register: true,
        ask_delivery_payment: true,
        group_kitchen_by_name: false,
        enable_pagers: false,
        max_active_orders_per_waiter: 0,
        lock_tables_to_waiter: false,
        // Billing settings
        enable_billing: false,
        billing_copies: '1',
        print_logo_on_invoice: true,
        commercial_name: '',
        legal_name: '',
        nit: '',
        billing_email: '',
        billing_address_1: '',
        billing_address_2: '',
        municipality: '',
        department: '',
        branch_code: '',
        branch_id: '',
        scenario_code: '1',
        ws_prefix: '',
        ws_key: '',
        signer_token: '',
        invoice_phrases: '',
        certifier_legend: '',
        isr_retention: false,
        iva_retention: false,
        no_iva_credit: false,
        exempt_iva: false,
        sucursal_id: '',
        local_kds_ip: '',
        main_printer_id: '',
        icon_theme: 'classic',
        monthly_waiter_goal: 0,
        waiter_goal_enabled: false,
        monthly_waiter_units_goal: 0,
        waiter_units_goal_enabled: false,
        // SAT Agencia Virtual credentials
        sat_username: '',
        sat_password: ''
    });

    const [branches, setBranches] = useState<any[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'ENVIRONMENT' | 'BILLING' | 'PERSONALIZATION' | 'SMTP'>('ENVIRONMENT');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const [initialConfig, setInitialConfig] = useState<string>('');
    const [testingSmtp, setTestingSmtp] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [testSmtpMsg, setTestSmtpMsg] = useState('');

    const getDirectUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const idMatch = url.match(/[-\w]{25,}/);
            if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
        }
        return url;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Eliminar fondo automáticamente
            const blob = await removeBackground(file);
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" });

            const fileName = `logo-${Math.random()}.png`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('branding').upload(filePath, processedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(filePath);
            setConfig({ ...config, logo_url: publicUrl });
            alert('Logotipo procesado y actualizado. No olvide guardar.');
        } catch (error: any) {
            console.error('Error al procesar imagen:', error);
            alert('Error al subir: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Eliminar fondo automáticamente
            const blob = await removeBackground(file);
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" });

            const fileName = `bg-${Math.random()}.png`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('branding').upload(filePath, processedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(filePath);
            setConfig({ ...config, login_background_url: publicUrl });
            alert('Imagen de fondo procesada y actualizada. No olvide guardar.');
        } catch (error: any) {
            console.error('Error al procesar imagen:', error);
            alert('Error al subir: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const [{ data: settingsData }, { data: branchesData }, { data: printersData }] = await Promise.all([
            supabase.from('system_settings').select('*').eq('id', 1).single(),
            supabase.from('branches').select('*').order('name'),
            supabase.from('printers').select('*').order('name')
        ]);

        if (settingsData) {
            setConfig((prev) => {
                const updated = { ...prev, ...settingsData };
                setInitialConfig(JSON.stringify(updated));
                return updated;
            });
        } else {
            setInitialConfig(JSON.stringify(config));
        }
        if (branchesData) setBranches(branchesData);
        if (printersData) setPrinters(printersData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        // Sincronizar tema externo si se proporciona
        if (currentTheme) {
            setConfig(prev => ({ ...prev, icon_theme: currentTheme }));
        }
    }, [currentTheme]);

    // Fetch branch-specific billing data when branch changes
    useEffect(() => {
        const fetchBranchBilling = async () => {
            if (!config.sucursal_id) return;
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .eq('id', config.sucursal_id)
                .single();

            if (data && !error) {
                setConfig(prev => {
                    const newConfig = {
                        ...prev,
                        enable_billing: data.enable_billing ?? false,
                        billing_copies: data.billing_copies ?? '1',
                        print_logo_on_invoice: data.print_logo_on_invoice ?? true,
                        commercial_name: data.commercial_name ?? '',
                        legal_name: data.legal_name ?? '',
                        nit: data.nit ?? '',
                        billing_email: data.billing_email ?? '',
                        billing_address_1: data.billing_address_1 ?? '',
                        billing_address_2: data.billing_address_2 ?? '',
                        municipality: data.municipality ?? '',
                        department: data.department ?? '',
                        branch_code: data.branch_code ?? '',
                        branch_id: data.branch_id ?? '',
                        scenario_code: data.scenario_code ?? '1',
                        ws_prefix: data.ws_prefix ?? '',
                        ws_key: data.ws_key ?? '',
                        signer_token: data.signer_token ?? '',
                        invoice_phrases: data.invoice_phrases ?? '',
                        certifier_legend: data.certifier_legend ?? '',
                        isr_retention: data.isr_retention ?? false,
                        iva_retention: data.iva_retention ?? false,
                        no_iva_credit: data.no_iva_credit ?? false,
                        exempt_iva: data.exempt_iva ?? false,
                    };
                    setInitialConfig(JSON.stringify(newConfig));
                    return newConfig;
                });
            }
        };
        fetchBranchBilling();
    }, [config.sucursal_id]);

    const handleTestSmtp = async () => {
        if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
            setTestSmtpMsg('Complete todos los campos SMTP antes de probar.');
            setTestingSmtp('error');
            return;
        }
        setTestingSmtp('loading');
        setTestSmtpMsg('');
        try {
            const electron = (window as any).electronAPI || (window as any).electron;
            if (!electron?.sendEmail) {
                throw new Error('Esta función solo está disponible en la aplicación de escritorio (Electron).');
            }
            const result = await electron.sendEmail({
                to: config.smtp_user,
                subject: '✅ Prueba SMTP — Restaurante Las Palmas POS',
                body: `Conexión SMTP verificada correctamente.\nHost: ${config.smtp_host}\nPuerto: ${config.smtp_port}\nUsuario: ${config.smtp_user}\nFecha: ${new Date().toLocaleString('es-GT')}`,
                smtpConfig: {
                    host: config.smtp_host,
                    port: parseInt(config.smtp_port) || 465,
                    user: config.smtp_user,
                    pass: config.smtp_pass
                }
            });
            if (result?.success) {
                setTestingSmtp('ok');
                setTestSmtpMsg(`✅ Correo de prueba enviado a ${config.smtp_user}`);
            } else {
                throw new Error(result?.error || 'Error desconocido del servidor SMTP.');
            }
        } catch (e: any) {
            setTestingSmtp('error');
            setTestSmtpMsg(`❌ Error: ${e.message}`);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Save global settings (Force ID 1 for consistency)
            const { error: sError } = await supabase.from('system_settings').upsert({ id: 1, ...config });
            if (sError) throw sError;

            // 2. Save branch-specific billing settings
            if (config.sucursal_id) {
                const { error: bError } = await supabase.from('branches').update({
                    enable_billing: config.enable_billing,
                    billing_copies: config.billing_copies,
                    print_logo_on_invoice: config.print_logo_on_invoice,
                    commercial_name: config.commercial_name,
                    legal_name: config.legal_name,
                    nit: config.nit,
                    billing_email: config.billing_email,
                    billing_address_1: config.billing_address_1,
                    billing_address_2: config.billing_address_2,
                    municipality: config.municipality,
                    department: config.department,
                    branch_code: config.branch_code,
                    scenario_code: config.scenario_code,
                    ws_prefix: config.ws_prefix,
                    ws_key: config.ws_key,
                    signer_token: config.signer_token,
                    invoice_phrases: config.invoice_phrases,
                    certifier_legend: config.certifier_legend,
                    isr_retention: config.isr_retention,
                    iva_retention: config.iva_retention,
                    no_iva_credit: config.no_iva_credit,
                    exempt_iva: config.exempt_iva,
                }).eq('id', config.sucursal_id);
                if (bError) throw bError;
            }

            // Reset the dirty tracking to the current state so it won't prompt again if the user immediately tries to exit
            setInitialConfig(JSON.stringify(config));

            // Logging: System Configuration Update
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (currentUser?.id) {
                activityLogService.log({
                    user: currentUser,
                    module: 'ADMIN',
                    action: 'Actualización de Configuración del Sistema',
                    details: {
                        restaurantName: config.restaurant_name,
                        updatedAt: new Date().toISOString()
                    }
                });
            }

            alert('Configuración guardada correctamente.');
        } catch (error: any) {
            alert('Error al guardar: ' + error.message);
        }
        setSaving(false);
    };

    const Toggle = ({ label, value, onChange }: any) => (
        <label className="flex items-center gap-2 cursor-pointer group">
            <div
                onClick={() => onChange(!value)}
                className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-all ${value ? 'bg-[#106ebe] border-[#106ebe]' : 'bg-white border-gray-300'}`}
            >
                {value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <span className="text-[11px] font-medium text-gray-600 leading-tight">{label}</span>
        </label>
    );

    // Pill-style switch for main feature toggles
    const SwitchToggle = ({ label, value, onChange }: any) => (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-[#106ebe]' : 'bg-gray-200'
                }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
            />
        </button>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-500">
            <Loader2 className="animate-spin" size={48} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cargando Configuración...</span>
        </div>
    );

    return (
        <>
            <div className={`w-full max-w-4xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col ${window.innerWidth < 640 ? 'h-full border-0 rounded-none' : 'h-[90vh]'} animate-in fade-in zoom-in duration-300`}>
                {/* Window Header */}
                <div className="modal-header bg-[#106ebe] px-4 py-2.5 flex items-center justify-between text-white shrink-0 cursor-default select-none">
                    <div className="flex items-center gap-3">
                        <Settings2 size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Configuración de Sistema</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button className="p-1 px-3 hover:bg-white/10 rounded transition-colors text-[10px] uppercase font-black tracking-widest border border-white/20 mr-2">
                            Anular Registro de Licencia
                        </button>
                        <WindowsSaveButton onClick={handleSave} loading={saving} title="Guardar Configuración" />
                        <button onClick={() => {
                            // Compare current form state with previously recorded baseline
                            if (JSON.stringify(config) !== initialConfig) {
                                setShowConfirmClose(true); // Is Dirty: Ask user
                            } else {
                                if (onClose) onClose(); // Pristine state: Close instantly
                            }
                        }} className="p-1.5 hover:bg-red-500 rounded transition-colors"><X size={14} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#f8f9fa] custom-scrollbar">
                    {/* Datos Generales Section */}
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 space-y-3">
                            <h2 className="text-[12px] font-black uppercase text-[#106ebe] tracking-widest mb-4 border-b border-blue-100 pb-1">Datos Generales</h2>

                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Sucursal</label>
                                <select
                                    value={config.sucursal_id || ''}
                                    onChange={e => setConfig({ ...config, sucursal_id: e.target.value })}
                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                >
                                    <option value="">Seleccionar Sucursal...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre</label>
                                <input
                                    value={config.restaurant_name}
                                    onChange={e => setConfig({ ...config, restaurant_name: e.target.value })}
                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Direccion</label>
                                <input
                                    value={config.address}
                                    onChange={e => setConfig({ ...config, address: e.target.value })}
                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Correo</label>
                                <input
                                    value={config.email}
                                    onChange={e => setConfig({ ...config, email: e.target.value })}
                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Telefono</label>
                                <div className="flex gap-2">
                                    <input
                                        value={config.phone}
                                        onChange={e => setConfig({ ...config, phone: e.target.value })}
                                        className="flex-1 bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                    />
                                    <input
                                        placeholder="Otro Tel..."
                                        className="w-24 bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                    />
                                </div>
                            </div>


                            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_1fr] grid-responsive-form items-center gap-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Sitio Web</label>
                                <input
                                    value={config.website}
                                    onChange={e => setConfig({ ...config, website: e.target.value })}
                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="w-48 shrink-0 flex flex-col items-center pt-8">
                            <div className="w-32 h-32 bg-white rounded-xl border border-gray-100 shadow-lg flex items-center justify-center overflow-hidden mb-4 p-2 relative group">
                                {config.logo_url ? (
                                    <img src={getDirectUrl(config.logo_url)} className="w-full h-full object-contain" />
                                ) : (
                                    <Building2 size={48} className="text-gray-200" />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                        <Loader2 className="animate-spin text-[#106ebe]" />
                                    </div>
                                )}
                            </div>
                            <label className="w-full bg-[#106ebe] hover:bg-[#106ebe] hover:brightness-110 text-white text-[10px] font-black uppercase text-center py-2.5 rounded-lg cursor-pointer transition-all shadow-lg mb-2 active:scale-95">
                                Subir Logotipo
                                <input type="file" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <button onClick={() => setConfig({ ...config, logo_url: '' })} className="w-full bg-white border border-gray-200 text-gray-500 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all active:scale-95">
                                Quitar Imagen
                            </button>
                        </div>
                    </div>

                    {/* Tabs Section */}
                    <div className="space-y-0 pt-4 flex-1 flex flex-col overflow-hidden">
                        <div className="flex admin-tabs-scroll scrollbar-hide">
                            <button
                                onClick={() => setActiveTab('ENVIRONMENT')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTab === 'ENVIRONMENT' ? 'bg-white border-gray-200 text-[#106ebe]' : 'bg-gray-100/50 border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                                Variables de Entorno
                            </button>
                            <button
                                onClick={() => setActiveTab('BILLING')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTab === 'BILLING' ? 'bg-white border-gray-200 text-[#106ebe]' : 'bg-gray-100/50 border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                                Facturación Electrónica
                            </button>
                            <button
                                onClick={() => setActiveTab('PERSONALIZATION')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTab === 'PERSONALIZATION' ? 'bg-white border-gray-200 text-[#106ebe]' : 'bg-gray-100/50 border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                                Personalización
                            </button>
                            <button
                                onClick={() => setActiveTab('SMTP')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTab === 'SMTP' ? 'bg-white border-gray-200 text-[#106ebe]' : 'bg-gray-100/50 border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                                Servidor SMTP
                            </button>
                        </div>

                        <div className="p-6 bg-white border border-gray-200 rounded-b-xl rounded-tr-xl flex-1 shadow-sm">
                            {activeTab === 'ENVIRONMENT' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                                    <div className="col-span-2 mb-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Correos Destinatarios de Corte de Caja (separados por coma)</label>
                                        <input
                                            value={config.cashier_emails}
                                            onChange={e => setConfig({ ...config, cashier_emails: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 text-[11px] font-bold px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-300 transition-all"
                                            placeholder="ejemplo@correo.com, admin@restaurante.com"
                                        />
                                    </div>

                                    <div className="col-span-2 mb-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">IP Servidor PC (KDS Local - Modo Offline)</label>
                                        <input
                                            value={config.local_kds_ip || ''}
                                            onChange={e => setConfig({ ...config, local_kds_ip: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 text-[11px] font-bold px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-300 transition-all"
                                            placeholder="Ej: 192.168.1.100"
                                        />
                                    </div>

                                    <div className="col-span-2 mb-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Punto de Impresión Principal (Tickets de Gasto, Turnos, etc)</label>
                                        <select
                                            value={config.main_printer_id || ''}
                                            onChange={e => setConfig({ ...config, main_printer_id: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 text-[11px] font-bold px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-300 transition-all"
                                        >
                                            <option value="">SELECCIONAR PUNTO DE IMPRESIÓN...</option>
                                            {printers.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.connection_type})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 mb-2 bg-blue-50/30 p-2 rounded-lg border border-blue-50/50">
                                            <Toggle label="Habilitar Cocina General" value={config.enable_general_kitchen} onChange={(v: boolean) => setConfig({ ...config, enable_general_kitchen: v })} />
                                        </div>
                                        <div className="flex items-center gap-4 bg-white border border-gray-50 p-2 rounded-lg">
                                            <Toggle label="Propina Sugerida" value={true} onChange={() => { }} />
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <input
                                                    value={config.suggested_tip}
                                                    onChange={e => setConfig({ ...config, suggested_tip: e.target.value })}
                                                    className="w-14 bg-gray-50 border border-gray-100 text-[11px] font-black p-1 rounded text-center"
                                                />
                                                <span className="text-[10px] font-black text-gray-400">%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center bg-white border border-gray-50 p-2 rounded-lg">
                                            <Toggle label="Redondear Propina" value={config.round_tip} onChange={(v: boolean) => setConfig({ ...config, round_tip: v })} />
                                        </div>

                                        <div className="pt-2 space-y-3">
                                            <Toggle label="Permitir cerrar turno con órdenes aun abiertas" value={config.allow_close_with_open_orders} onChange={(v: boolean) => setConfig({ ...config, allow_close_with_open_orders: v })} />
                                            <Toggle label="Permitir cerrar turno con órdenes abiertas a nombre del cajero" value={config.allow_close_with_cashier_orders} onChange={(v: boolean) => setConfig({ ...config, allow_close_with_cashier_orders: v })} />
                                            <Toggle label="Permitir a varios Cajeros operar la misma caja durante un turno" value={config.multi_cashier_register} onChange={(v: boolean) => setConfig({ ...config, multi_cashier_register: v })} />
                                            <Toggle label="Solicitar PIN al ingresar a una caja" value={config.require_pin_for_register} onChange={(v: boolean) => setConfig({ ...config, require_pin_for_register: v })} />
                                            <Toggle label="Preguntar forma de pago del cliente en Ordenes Domicilio" value={config.ask_delivery_payment} onChange={(v: boolean) => setConfig({ ...config, ask_delivery_payment: v })} />
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-4 border-b border-gray-200 pb-1">Configuración Operativa de Tickets</label>
                                        <Toggle label="Activar Venta Rápida (para restaurantes de Food Court)" value={config.enable_quick_sale} onChange={(v: boolean) => setConfig({ ...config, enable_quick_sale: v })} />
                                        <Toggle label="Permitir abrir una Orden únicamente al Mesero / Cajero que la creó" value={config.limit_order_access} onChange={(v: boolean) => setConfig({ ...config, limit_order_access: v })} />
                                        <Toggle label="Imprimir ticket de Gasto de caja" value={config.print_expense_ticket} onChange={(v: boolean) => setConfig({ ...config, print_expense_ticket: v })} />
                                        <Toggle label="Imprimir ticket de número de Orden (Ordenes para Llevar)" value={config.print_order_num_ticket} onChange={(v: boolean) => setConfig({ ...config, print_order_num_ticket: v })} />
                                        <Toggle label="Imprimir ticket de cobro después de cerrar una orden" value={config.print_charge_ticket} onChange={(v: boolean) => setConfig({ ...config, print_charge_ticket: v })} />
                                        <Toggle label="Imprimir ticket de Orden Anulada" value={config.print_cancelled_ticket} onChange={(v: boolean) => setConfig({ ...config, print_cancelled_ticket: v })} />
                                        <Toggle label="Imprimir ticket de Platos Eliminados" value={config.print_deleted_ticket} onChange={(v: boolean) => setConfig({ ...config, print_deleted_ticket: v })} />
                                        <Toggle label="Agrupar Comanda de Cocina por nombre de Cuenta" value={config.group_kitchen_by_name} onChange={(v: boolean) => setConfig({ ...config, group_kitchen_by_name: v })} />
                                        <Toggle label="Activar Pager en Venta Rápida / Para Llevar" value={config.enable_pagers} onChange={(v: boolean) => setConfig({ ...config, enable_pagers: v })} />
                                    </div>

                                    <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                                        <label className="text-[9px] font-black text-[#106ebe] uppercase tracking-widest block mb-4 border-b border-blue-200/50 pb-1">Credenciales SAT — Agencia Virtual</label>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Usuario SAT</label>
                                            <input
                                                value={config.sat_username}
                                                onChange={e => setConfig({ ...config, sat_username: e.target.value })}
                                                className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                placeholder="NIT o usuario de Agencia Virtual"
                                            />
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña SAT</label>
                                            <input
                                                type="password"
                                                value={config.sat_password}
                                                onChange={e => setConfig({ ...config, sat_password: e.target.value })}
                                                className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <p className="text-[9px] text-gray-400 italic">Estas credenciales se utilizan para sincronizar facturas desde Contabilidad → Compras → Sincronizar SAT.</p>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'BILLING' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-3 mb-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                        <Toggle
                                            label="Habilitar Facturación Electrónica (FEL)"
                                            value={config.enable_billing}
                                            onChange={(v: boolean) => setConfig({ ...config, enable_billing: v })}
                                        />
                                    </div>

                                    <div className={`space-y-4 transition-all duration-300 ${!config.enable_billing ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Copias a Imprimir</label>
                                                    <input
                                                        type="number"
                                                        value={config.billing_copies}
                                                        onChange={e => setConfig({ ...config, billing_copies: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex items-center py-1">
                                                    <Toggle
                                                        label="Imprimir logotipo en factura (Utilice logo en blanco y negro, fondo blanco)"
                                                        value={config.print_logo_on_invoice}
                                                        onChange={(v: boolean) => setConfig({ ...config, print_logo_on_invoice: v })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Comercial</label>
                                                <input
                                                    value={config.commercial_name}
                                                    onChange={e => setConfig({ ...config, commercial_name: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Razón Social</label>
                                                <input
                                                    value={config.legal_name}
                                                    onChange={e => setConfig({ ...config, legal_name: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">NIT</label>
                                                    <input
                                                        value={config.nit}
                                                        onChange={e => setConfig({ ...config, nit: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Correo</label>
                                                    <input
                                                        value={config.billing_email}
                                                        onChange={e => setConfig({ ...config, billing_email: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Dirección 1</label>
                                                <input
                                                    value={config.billing_address_1}
                                                    onChange={e => setConfig({ ...config, billing_address_1: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Dirección 2</label>
                                                <input
                                                    value={config.billing_address_2}
                                                    onChange={e => setConfig({ ...config, billing_address_2: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Municipio</label>
                                                    <input
                                                        value={config.municipality}
                                                        onChange={e => setConfig({ ...config, municipality: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Departamento</label>
                                                    <select
                                                        value={config.department}
                                                        onChange={e => setConfig({ ...config, department: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        <option value="Retalhuleu">Retalhuleu</option>
                                                        <option value="Guatemala">Guatemala</option>
                                                        <option value="Quetzaltenango">Quetzaltenango</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Cod. Sucursal</label>
                                                    <input
                                                        value={config.branch_code}
                                                        onChange={e => setConfig({ ...config, branch_code: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">ID Sucursal</label>
                                                    <input
                                                        value={config.branch_id}
                                                        onChange={e => setConfig({ ...config, branch_id: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Escenario</label>
                                                    <input
                                                        value={config.scenario_code}
                                                        onChange={e => setConfig({ ...config, scenario_code: e.target.value })}
                                                        className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Prefijo WS</label>
                                                <input
                                                    value={config.ws_prefix}
                                                    onChange={e => setConfig({ ...config, ws_prefix: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Llave WS</label>
                                                <input
                                                    value={config.ws_key}
                                                    onChange={e => setConfig({ ...config, ws_key: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Token Signer</label>
                                                <input
                                                    value={config.signer_token}
                                                    onChange={e => setConfig({ ...config, signer_token: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Frases Factura</label>
                                                <input
                                                    value={config.invoice_phrases}
                                                    onChange={e => setConfig({ ...config, invoice_phrases: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Leyenda Certificador</label>
                                                <input
                                                    value={config.certifier_legend}
                                                    onChange={e => setConfig({ ...config, certifier_legend: e.target.value })}
                                                    className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-4 pt-3 border-t border-gray-50">
                                                <Toggle label="Frase Retención ISR" value={config.isr_retention} onChange={(v: boolean) => setConfig({ ...config, isr_retention: v })} />
                                                <Toggle label="Frase Retención del IVA" value={config.iva_retention} onChange={(v: boolean) => setConfig({ ...config, iva_retention: v })} />
                                                <Toggle label="Frase No Derecho Crédito Fiscal IVA" value={config.no_iva_credit} onChange={(v: boolean) => setConfig({ ...config, no_iva_credit: v })} />
                                                <Toggle label="Frase Exento o No Afecto IVA" value={config.exempt_iva} onChange={(v: boolean) => setConfig({ ...config, exempt_iva: v })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'PERSONALIZATION' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h3 className="text-[11px] font-black text-[#106ebe] uppercase tracking-widest border-b border-blue-50 pb-2">Gestión de Meseros</h3>
                                            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                                                <div className="grid grid-cols-[140px_1fr] md:grid-cols-[140px_1fr] grid-responsive-form items-center gap-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Ordenes Máx / Mesero</label>
                                                    <div className="flex flex-col gap-3 w-full">
                                                        <input
                                                            type="number"
                                                            value={config.max_active_orders_per_waiter}
                                                            onChange={e => setConfig({ ...config, max_active_orders_per_waiter: parseInt(e.target.value) || 0 })}
                                                            className="w-full bg-white border border-gray-100 text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                            placeholder="0 = Ilimitado"
                                                        />
                                                        <div className="pt-1">
                                                            <Toggle label="Bloquear Mesas al Mesero que tomó la Orden" value={config.lock_tables_to_waiter} onChange={(v: boolean) => setConfig({ ...config, lock_tables_to_waiter: v })} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Meta de Ventas con interruptor */}
                                                <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Meta Ventas Mes</label>
                                                        <SwitchToggle
                                                            value={config.waiter_goal_enabled}
                                                            onChange={(v: boolean) => setConfig({ ...config, waiter_goal_enabled: v })}
                                                        />
                                                    </div>
                                                    <div className={`relative transition-opacity ${config.waiter_goal_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{config.currency}</span>
                                                        <input
                                                            type="number"
                                                            value={config.monthly_waiter_goal}
                                                            onChange={e => setConfig({ ...config, monthly_waiter_goal: parseFloat(e.target.value) || 0 })}
                                                            className="w-full bg-white border border-gray-100 text-[11px] font-bold pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Meta por Unidades con interruptor */}
                                                <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Meta por Unidades Mes</label>
                                                        <SwitchToggle
                                                            value={config.waiter_units_goal_enabled}
                                                            onChange={(v: boolean) => setConfig({ ...config, waiter_units_goal_enabled: v })}
                                                        />
                                                    </div>
                                                    <div className={`relative transition-opacity ${config.waiter_units_goal_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">#</span>
                                                        <input
                                                            type="number"
                                                            value={config.monthly_waiter_units_goal}
                                                            onChange={e => setConfig({ ...config, monthly_waiter_units_goal: parseInt(e.target.value) || 0 })}
                                                            className="w-full bg-white border border-gray-100 text-[11px] font-bold pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-[#106ebe] shadow-sm"
                                                            placeholder="0 unidades"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Icon Theme Toggle */}
                                            <h3 className="text-[11px] font-black text-[#106ebe] uppercase tracking-widest border-b border-blue-50 pb-2 pt-2">Iconografía del Sistema</h3>
                                            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setConfig({ ...config, icon_theme: 'classic' })}
                                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${config.icon_theme === 'classic' ? 'border-[#106ebe] bg-blue-50/50' : 'border-gray-100 hover:border-blue-200 bg-white'}`}
                                                    >
                                                        <Layers size={24} className={config.icon_theme === 'classic' ? 'text-[#106ebe]' : 'text-gray-400'} />
                                                        <span className={`text-[10px] font-black uppercase ${config.icon_theme === 'classic' ? 'text-[#106ebe]' : 'text-gray-500'}`}>Clásico (Lucide)</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setConfig({ ...config, icon_theme: 'premium' })}
                                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${config.icon_theme === 'premium' ? 'border-[#106ebe] bg-blue-50/50' : 'border-gray-100 hover:border-blue-200 bg-white'}`}
                                                    >
                                                        <Baseline size={24} className={config.icon_theme === 'premium' ? 'text-[#106ebe]' : 'text-gray-400'} />
                                                        <span className={`text-[10px] font-black uppercase ${config.icon_theme === 'premium' ? 'text-[#106ebe]' : 'text-gray-500'}`}>Premium (Iconify)</span>
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-gray-400 italic text-center">El tema Premium utiliza iconos Flat Business de alta fidelidad. Requiere reinicio de la vista para aplicar cambios globales.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <h3 className="text-[11px] font-black text-[#106ebe] uppercase tracking-widest border-b border-blue-50 pb-2">Fondo de Pantalla (Login)</h3>
                                            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                                                <div className="w-full aspect-video bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden relative group">
                                                    {config.login_background_url ? (
                                                        <img src={getDirectUrl(config.login_background_url)} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2">
                                                            <Globe size={48} className="stroke-[1]" />
                                                            <span className="text-[10px] font-bold uppercase">Sin imagen de fondo</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <label className="bg-[#106ebe] hover:bg-[#106ebe] hover:brightness-110 text-white text-[10px] font-black uppercase text-center py-2.5 rounded-lg cursor-pointer transition-all shadow-sm active:scale-95">
                                                        Cambiar Fondo
                                                        <input type="file" onChange={handleBackgroundUpload} className="hidden" />
                                                    </label>
                                                    <button onClick={() => setConfig({ ...config, login_background_url: '' })} className="bg-white border border-gray-100 text-gray-400 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all active:scale-95">
                                                        Quitar Fondo
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'SMTP' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-blue-50/50 border border-blue-100 border-dashed p-4 rounded-xl flex items-center gap-4">
                                        <div className="w-10 h-10 bg-[#106ebe] text-white rounded-lg flex items-center justify-center shrink-0">
                                            <Mail size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest leading-none mb-1">Configuración de Mensajería</h4>
                                            <p className="text-[10px] font-medium text-[#106ebe]/70">Configure su servidor propio para el envío de reportes y notificaciones automáticas.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl mx-auto">
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Servidor Host</label>
                                            <input
                                                value={config.smtp_host}
                                                onChange={e => setConfig({ ...config, smtp_host: e.target.value })}
                                                className="w-full bg-gray-50/50 border border-gray-100 text-[11px] font-bold px-4 py-2 rounded-lg outline-none focus:bg-white focus:border-[#106ebe] shadow-sm transition-all"
                                                placeholder="smtp.gmail.com"
                                            />
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Puerto</label>
                                            <input
                                                value={config.smtp_port}
                                                onChange={e => setConfig({ ...config, smtp_port: e.target.value })}
                                                className="w-full bg-gray-50/50 border border-gray-100 text-[11px] font-bold px-4 py-2 rounded-lg outline-none focus:bg-white focus:border-[#106ebe] shadow-sm transition-all"
                                                placeholder="587 / 465"
                                            />
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Usuario / Email</label>
                                            <input
                                                value={config.smtp_user}
                                                onChange={e => setConfig({ ...config, smtp_user: e.target.value })}
                                                className="w-full bg-gray-50/50 border border-gray-100 text-[11px] font-bold px-4 py-2 rounded-lg outline-none focus:bg-white focus:border-[#106ebe] shadow-sm transition-all"
                                                placeholder="info@empresa.com"
                                            />
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Contraseña</label>
                                            <input
                                                type="password"
                                                value={config.smtp_pass}
                                                onChange={e => setConfig({ ...config, smtp_pass: e.target.value })}
                                                className="w-full bg-gray-50/50 border border-gray-100 text-[11px] font-bold px-4 py-2 rounded-lg outline-none focus:bg-white focus:border-[#106ebe] shadow-sm transition-all"
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-gray-50 flex flex-col items-end gap-3">
                                            {testSmtpMsg && (
                                                <p className={`text-[10px] font-bold ${testingSmtp === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {testSmtpMsg}
                                                </p>
                                            )}
                                            <button
                                                onClick={handleTestSmtp}
                                                disabled={testingSmtp === 'loading'}
                                                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 border shadow-sm flex items-center gap-2 ${
                                                    testingSmtp === 'ok' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    testingSmtp === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                                                    'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {testingSmtp === 'loading' ? '⏳ Enviando...' :
                                                 testingSmtp === 'ok' ? '✅ Conexión OK' :
                                                 testingSmtp === 'error' ? '❌ Reintentar' :
                                                 'Probar Conexión'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="bg-[#f1f3f5] px-4 py-1.5 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0 border-t border-gray-200">
                    <div className="flex gap-4">
                        <span>Versión: {packageJson.version}</span>
                        <span className="text-blue-300">|</span>
                        <span>Licencia: Activa</span>
                    </div>
                    <span>Restaurante Las Palmas POS © 2026</span>
                </div>

                <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>

                {
                    showConfirmClose && (
                        <WindowsConfirmModal
                            message="¿Desea guardar los cambios realizados en el formulario?"
                            onConfirm={async () => {
                                await handleSave();
                                setShowConfirmClose(false);
                                if (onClose) onClose();
                            }}
                            onDeny={() => {
                                setShowConfirmClose(false);
                                if (onClose) onClose();
                            }}
                            onCancel={() => setShowConfirmClose(false)}
                        />
                    )
                }
            </div >
        </>
    );
};
