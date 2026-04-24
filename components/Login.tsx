import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../supabase';
import { ArrowLeft, Loader2, User as UserIcon, Building2, Calculator, Users, ChefHat, ShieldCheck, Check, Delete, X, Settings, LogOut, Minus, Layers } from 'lucide-react';
import { activityLogService } from '../services/ActivityLogService';

const CashRegisterIcon = ({ size = 24, strokeWidth = 1.5, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="17" width="18" height="4" rx="1.5" />
    <path d="M5 17V9h14v8" />
    <rect x="11" y="3" width="8" height="4" rx="1" />
    <path d="M14 7v2" />
    <path d="M16 7v2" />
    <path d="M7 14v-3l1-1 1 1 1-1 1 1v3" />
    <path d="M6 14h6" />
    <path fill="currentColor" stroke="none" d="M12.75 10.25h1.5v1.5h-1.5z M14.75 10.25h1.5v1.5h-1.5z M16.75 10.25h1.5v1.5h-1.5z M12.75 12.25h1.5v1.5h-1.5z M14.75 12.25h1.5v1.5h-1.5z M16.75 12.25h1.5v1.5h-1.5z M12.75 14.25h1.5v1.5h-1.5z M14.75 14.25h1.5v1.5h-1.5z M16.75 14.25h1.5v1.5h-1.5z" />
  </svg>
);
import { PrinterSelector } from './PrinterSelector';

interface LoginProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onRefreshMenu?: (type: 'config' | 'images' | 'all') => Promise<void>;
  syncType?: 'config' | 'images' | 'all' | null;
  isSyncing?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onRefreshMenu, syncType, isSyncing }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPinPad, setShowPinPad] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [showRegisterSelection, setShowRegisterSelection] = useState(false);
  const [registerList, setRegisterList] = useState<any[]>([]);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [selectedCloseDate, setSelectedCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRegisterForClose, setSelectedRegisterForClose] = useState<'ALL' | string>('ALL');
  const [selectedProfileForPin, setSelectedProfileForPin] = useState<any | null>(null);
  const [openShiftUserIds, setOpenShiftUserIds] = useState<string[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  // --- NUEVOS ESTADOS PARA REDISEÑO MÓVIL (PWA/SMARTPHONE) ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [loginStep, setLoginStep] = useState<'ROLE' | 'CREDENTIALS'>('ROLE');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getDirectUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return 'https://drive.google.com/uc?export=view&id=' + idMatch[0];
    }
    return url;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: brandData }, { data: branchData }] = await Promise.all([
          supabase.from('system_settings').select('restaurant_name, logo_url, login_background_url, sucursal_id').eq('id', 1).single(),
          supabase.from('branches').select('id, name').order('name')
        ]);

        if (brandData) {
          setBranding(brandData);
          if (branchData && branchData.length > 0) {
            setBranches(branchData);

            // Lógica de Autoselección
            const cachedActivation = localStorage.getItem('activation_data');
            if (cachedActivation) {
              const activation = JSON.parse(cachedActivation);
              if (activation.branch_id) {
                console.log('📦 Sucursal activada:', activation.branch_name);
                setSelectedBranchId(activation.branch_id);
              }
            } else if (brandData.sucursal_id) {
              setSelectedBranchId(brandData.sucursal_id);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      }
    };
    fetchData();
  }, []);

  // --- Lógica de Selección de Rol ---
  const handleRoleSelect = async (role: string) => {
    setError('');
    setSelectedRole(role as any);

    if (isMobile) {
      // En móvil, siempre pasamos al segundo paso (Credenciales) para consistencia de flujo 
      // y para permitir seleccionar sucursal antes del bypass si fuera necesario.
      setLoginStep('CREDENTIALS');
      return;
    }

    if (role === 'COCINA' || role === 'PRODUCCION') {
      // BYPASS KDS/PRODUCCION: Entra directo (Solo en Tablet/PC)
      setLoading(true);
      try {
        const { data: profile } = await supabase.from('profiles')
          .select('*')
          .eq('role', role)
          .eq('branch_id', selectedBranchId)
          .limit(1)
          .maybeSingle();

        if (profile) {
          executeLogin(profile);
        } else if (role === 'PRODUCCION') {
          // Si es producción y no existe perfil, creamos un objeto invitado para entrar al módulo
          executeLogin({
            id: 'guest-production',
            name: 'Módulo Producción',
            role: 'PRODUCCION',
            branch_id: selectedBranchId,
            permissions: []
          } as any);
        } else {
          setError(`No hay perfil ${role} para esta sucursal`);
        }
      } catch (e) { setError('Error en ' + role); }
      finally { setLoading(false); }
    } else if (role === 'MESERO') {
      // LOGIN POR PIN: Abre el teclado
      setPin('');
      setShowPinPad(true);
    } else {
      // LOGIN CORPORATIVO: Usa el formulario de la izquierda
    }
  };

  // Keyboard integration for PIN PAD
  useEffect(() => {
    if (!showPinPad) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setShowPinPad(false);
        setPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinPad, pin]);

  const handlePinInput = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) handleLogin(undefined, newPin);
    }
  };

  const fetchAuthorizedProfiles = useCallback(async (branchId: string) => {
    const rolesToFetch = ['CAJERO', 'ADMIN', 'ADMINISTRADOR', 'MESERO'];
    const { data: registers } = await supabase
      .from('profiles')
      .select('*')
      .eq('branch_id', branchId)
      .in('role', rolesToFetch)
      .order('name');

    setRegisterList(registers || []);

    const { data: openShifts } = await supabase
      .from('shifts')
      .select('cashier_id')
      .is('end_time', null); // Shift is still active if NO closure time exists

    if (openShifts) {
      setOpenShiftUserIds(openShifts.map(s => s.cashier_id));
    }
  }, []);

  const handleLoginSuccess = async (user: any) => {
    setAuthenticatedUser(user);
    localStorage.setItem('operatorDashboardLead', JSON.stringify(user));
    setShowRegisterSelection(true);
    if ((window as any).electronAPI) (window as any).electronAPI.sendLoginSuccess();
    await fetchAuthorizedProfiles(selectedBranchId);
  };

  // AUTO-SHOW REMOVED FOR SECURITY (USER REQUEST)


  const handleLogin = async (e?: React.FormEvent, pinFromPad?: string) => {
    if (e) e.preventDefault();
    const currentPass = pinFromPad || password;
    const currentUser = pinFromPad ? '' : username;

    if (!pinFromPad && (!username || !password)) {
      setError('Datos incompletos');
      return;
    }
    if (!selectedRole) {
      setError('SELECCIONA TU PERFIL EN LA DERECHA');
      return;
    }
    if (!selectedBranchId) {
      setError('POR FAVOR SELECCIONA UNA SUCURSAL');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // 0. Validación Dashboard de Operadores (PIN por cada compañero)
      if (pinFromPad && selectedProfileForPin) {
        if (pinFromPad === selectedProfileForPin.pin) {
          executeLogin(selectedProfileForPin);
          setPin('');
          setShowPinPad(false);
          setSelectedProfileForPin(null);
          return;
          return;
        } else {
          setError('PIN INCORRECTO');
          
          activityLogService.log({
            user: { id: selectedProfileForPin.id, name: selectedProfileForPin.name, role: selectedProfileForPin.role } as any,
            module: 'ADMIN',
            action: 'Intento de PIN Fallido (Dashboard)',
            details: {
              targetUser: selectedProfileForPin.name,
              branch_id: selectedBranchId
            }
          });

          setPin('');
          setTimeout(() => setError(''), 2000);
          return;
        }
      }

      // 1. Fetch Profile
      let query = supabase.from('profiles').select('*');

      // Si viene del Pad (Mesero) siempre usamos PIN
      if (pinFromPad) {
        query = query.eq('pin', currentPass);
      } else {
        // Si viene del Formulario
        // SOPORTE PARA ADMIN: Un Admin puede usar su contraseña incluso si pulsa "CAJERO"
        // Pero no sabemos si es admin hasta que lo consultamos. 
        // Por ahora, si es ADMIN o el pass parece contraseña (tiene letras), buscamos por password o pin
        if (selectedRole === 'ADMIN') {
          query = query.eq('password', currentPass);
        } else {
          // Intentar buscar por PIN, pero si falla, el ADMIN podrá entrar luego
          query = query.or(`pin.eq.${currentPass},password.eq.${currentPass}`);
        }

        // Incluir username en la búsqueda - SOPORTE PARA ESPACIOS CON COMILLAS
        const cleanUser = currentUser.trim();
        query = query.or(`name.eq."${cleanUser}",email.eq."${cleanUser}",username.eq."${cleanUser}"`);
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError || !profiles || profiles.length === 0) {
        throw new Error(pinFromPad ? 'PIN incorrecto' : 'Credenciales inválidas');
      }

      const user = profiles[0];

      // VALIDACIÓN DE ROL: Los ADMIN pueden entrar con cualquier botón (Cajero, Mesero, etc.)
      // CAJERO también puede usar el PIN pad de MESERO.
      const isCashierEnteringAsWaiter = user.role === 'CAJERO' && selectedRole === 'MESERO';

      if (user.role !== 'ADMIN' && user.role !== selectedRole && !isCashierEnteringAsWaiter) {
        throw new Error(`Este usuario tiene el perfil de ${user.role}, debe seleccionar ese botón para entrar`);
      }

      // 🛡️ SEGURIDAD DE SUCURSAL: Bloquear si el usuario no pertenece a esta sucursal
      // Si el branch_id está definido (no es null ni vacío), debe coincidir con la sucursal seleccionada
      if (user.branch_id && user.branch_id !== selectedBranchId) {
        // Buscamos el nombre de la sucursal del usuario para un mensaje más claro si es posible, 
        // pero por ahora un error genérico de seguridad es más seguro.
        throw new Error(`ACCESO DENEGADO: Tu usuario pertenece a otra sucursal y no tienes permiso de Multi-Sucursal.`);
      }

      // Si es CAJERO, pasamos a la selección de "Caja" (Dashboard de Cajas)
      // EXCEPTO si entró como MESERO usando PIN, en cuyo caso entra directo.
      if (user.role === 'CAJERO' && !isCashierEnteringAsWaiter) {
        handleLoginSuccess(user);
      } else {
        // Si ingresó por botón MESERO intencionalmente y es CAJERO, su sesión asume rol de MESERO 
        // para tener la experiencia fluida de atención a mesas, o retiene su rol si así se prefiere.
        // Aquí le damos el rol MESERO temporalmente para que entre directo a hacer el pedido
        // sin que App.tsx requiera apertura de caja si usan otra tablet.
        const sessionUser = isCashierEnteringAsWaiter ? { ...user, role: 'MESERO' } : user;
        executeLogin(sessionUser);
      }
    } catch (err: any) {
      setError(err.message);
      
      // Logging: Authentication Failure
      activityLogService.log({
        user: { id: 'unknown', name: username || 'Pad User', role: selectedRole } as any,
        module: 'ADMIN',
        action: 'Fallo de Autenticación',
        details: {
          error: err.message,
          inputUser: username,
          roleAttempt: selectedRole,
          branchAttempt: selectedBranchId,
          method: pinFromPad ? 'PINPad' : 'Credentials'
        }
      });

      setPin('');
    } finally { setLoading(false); }
  };
  const handleOperatorClick = (profile: any) => {
    setSelectedProfileForPin(profile);
    setError('');
    setPin('');
    setShowPinPad(true);
  };

  const handlePrintReport = () => {
    const target = selectedRegisterForClose === 'ALL' ? 'TODAS LAS CAJAS' :
      (registerList.find(r => r.id === selectedRegisterForClose)?.name || authenticatedUser?.name || 'CAJA');

    // Simular generación de PDF y comando de impresión nativo
    const notify = (window as any).notify;
    if (notify) notify.success(`Generando Cierre: ${target} - Fecha: ${selectedCloseDate}`);
    else alert(`Generando Cierre: ${target} - Fecha: ${selectedCloseDate}`);

    // Aquí iría la lógica real de impresión (window.print, o IPC a Electron para termal printer)
  };

  const handleSendEmailReport = async () => {
    const target = selectedRegisterForClose === 'ALL' ? 'TODAS LAS CAJAS' :
      (registerList.find(r => r.id === selectedRegisterForClose)?.name || authenticatedUser?.name || 'CAJA');

    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('cashier_emails, restaurant_name, smtp_host, smtp_port, smtp_user, smtp_pass')
        .single();

      if (!settings?.cashier_emails) throw new Error('No hay correos destinatarios configurados.');
      if (!settings?.smtp_host || !settings?.smtp_user) throw new Error('No hay configuración SMTP.');

      // Fetch shifts for the selected date
      let query = supabase.from('shifts').select('*').eq('status', 'CLOSED');

      // Filter by date (casting to DATE in postgres)
      query = query.gte('end_time', `${selectedCloseDate}T00:00:00`).lt('end_time', `${selectedCloseDate}T23:59:59`);

      if (selectedRegisterForClose !== 'ALL') {
        query = query.eq('cash_register_id', selectedRegisterForClose);
      }

      const { data: shifts, error: shiftsError } = await query;
      if (shiftsError) throw shiftsError;

      if (!shifts || shifts.length === 0) {
        throw new Error('No hay turnos cerrados para la fecha seleccionada.');
      }

      // Aggregate totals
      let totalVentas = 0;
      let totalEfectivo = 0;
      let totalSobranteFaltante = 0;

      shifts.forEach(s => {
        totalEfectivo += (s.counted_amount || 0);
        totalSobranteFaltante += (s.difference_amount || 0);
      });

      const emailSubject = `Cierre Diario - ${target} - ${selectedCloseDate}`;
      const emailBody = `
REPORTE DE CIERRE DIARIO
${settings.restaurant_name || 'RESTAURANTE'}
═══════════════════════════════════════
Fecha Comercial: ${selectedCloseDate}
Caja(s): ${target}
Total Turnos Evaluados: ${shifts.length}

RESUMEN DE EFECTIVO CONTADO: Q${totalEfectivo.toFixed(2)}
SOBRANTE/FALTANTE GLOBAL: Q${totalSobranteFaltante.toFixed(2)}

Generado: ${new Date().toLocaleString('es-GT')}
      `.trim();

      const electron = (window as any).electronAPI || (window as any).electron;
      if (electron && electron.sendEmail) {
        const response = await electron.sendEmail({
          to: settings.cashier_emails,
          subject: emailSubject,
          body: emailBody,
          smtpConfig: {
            host: settings.smtp_host,
            port: settings.smtp_port ? parseInt(settings.smtp_port) : 465,
            user: settings.smtp_user,
            pass: settings.smtp_pass
          }
        });

        if (response.success) {
          const notify = (window as any).notify;
          if (notify) notify.success(`Correo enviado exitosamente a ${settings.cashier_emails}`);
          else alert(`Correo enviado exitosamente a ${settings.cashier_emails}`);
        } else {
          throw new Error(response.error || 'Error desconocido de SMTP');
        }
      } else {
        throw new Error('El servicio de correo electrónico local no está disponible.');
      }
    } catch (e: any) {
      alert(`Error al enviar correo: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeLogin = async (profile: any) => {
    let permissions: string[] = [];
    if (profile.role_id) {
      const { data: roleData } = await supabase.from('roles').select('permissions').eq('id', profile.role_id).maybeSingle();
      if (roleData) {
        const rawPerms = roleData.permissions;
        if (Array.isArray(rawPerms)) {
          permissions = (rawPerms as string[]).map(p => p.toLowerCase().trim());
        } else if (typeof rawPerms === 'object' && rawPerms !== null) {
          // DATABASE PERMISSIONS OBJECT: Extract keys where value is true
          permissions = Object.entries(rawPerms)
            .filter(([_, val]) => val === true)
            .map(([key, _]) => key.toLowerCase().trim());

          if (permissions.length === 0 && (rawPerms as any).actions) {
            permissions = ((rawPerms as any).actions || []).map((p: string) => p.toLowerCase().trim());
          }
        }
      }
    }
    // 3. Branch ID (Use manually selected branch if available)
    let finalBranchId = selectedBranchId || profile.branch_id;
    if (!finalBranchId) {
      const { data: settingsData } = await supabase.from('system_settings').select('sucursal_id').single();
      finalBranchId = settingsData?.sucursal_id || null;
    }

    const userWithPerms: User = {
      id: profile.id,
      name: profile.name || profile.full_name || 'Usuario',
      // Si estamos en la selección de registros, forzamos el rol a CAJERO para entrar a Caja
      role: (showRegisterSelection) ? 'CAJERO' : (profile.role || 'MESERO'),
      originalRole: profile.role,
      role_id: profile.role_id,
      permissions: permissions.map(p => p.toLowerCase()),
      branch_id: finalBranchId,
      org_id: profile.org_id,
      is_superadmin: profile.is_superadmin
    };

    localStorage.setItem('currentUser', JSON.stringify(userWithPerms));
    
    // Logging: Successful Login
    activityLogService.log({
      user: userWithPerms,
      module: 'ADMIN',
      action: 'Inicio de Sesión Exitoso',
      details: {
        method: showRegisterSelection ? 'Dashboard' : 'Personal',
        originalRole: profile.role,
        branch_id: finalBranchId
      }
    });

    if ((window as any).electronAPI) (window as any).electronAPI.sendLoginSuccess();
    onLogin(userWithPerms);
  };


  if (isMobile && !showRegisterSelection) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-[#1a1b23] relative overflow-hidden font-sans select-none">
        {/* FONDO DE PANTALLA COMPLETO CON OVERLAY */}
        <div className="absolute inset-0 z-0">
          {branding?.login_background_url && (
            <img
              src={getDirectUrl(branding.login_background_url)}
              className="w-full h-full object-cover opacity-40"
              alt="Background"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b23] via-[#1a1b23]/60 to-transparent" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col p-6 h-full">
          {loginStep === 'ROLE' ? (
            /* PASO 1: SELECCIÓN DE ROL (MOBILE) */
            <div className="flex-1 flex flex-col animate-fade-in justify-center pt-10">
              <div className="mb-10 text-center">
                <h2 className="text-[24px] font-black text-white tracking-tighter uppercase leading-none mb-2">BIENVENIDO</h2>
                <div className="w-12 h-1 bg-[#4f46e5] rounded-full mx-auto mb-6" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Selecciona tu Perfil</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full">
                {[
                  { id: 'CAJERO', icon: <CashRegisterIcon size={24} />, label: 'Cajero' },
                  { id: 'MESERO', icon: <Users size={24} />, label: 'Mesero' },
                  { id: 'COCINA', icon: <ChefHat size={24} />, label: 'KDS' },
                  { id: 'ADMIN', icon: <ShieldCheck size={24} />, label: 'Admin' },
                  { id: 'PRODUCCION', icon: <Layers size={24} />, label: 'Producción', fullWidth: true }
                ].map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id as UserRole)}
                    className={`flex flex-col items-center justify-center p-6 rounded-[24px] transition-all active:scale-95 border border-white/10 shadow-2xl backdrop-blur-md
                      ${role.fullWidth ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}
                      ${selectedRole === role.id ? 'bg-[#4f46e5] border-[#4f46e5]' : 'bg-white/5 hover:bg-white/10'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${selectedRole === role.id ? 'bg-white text-[#4f46e5]' : 'bg-white/5 text-[#4f46e5]'}`}>
                      {role.icon}
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest text-white">{role.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* PASO 2: CREDENCIALES (MOBILE) */
            <div className="flex-1 flex flex-col animate-fade-in pt-10">
              <div className="flex items-center gap-4 mb-10">
                <button
                  onClick={() => setLoginStep('ROLE')}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 active:bg-white/10"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="text-[16px] font-black text-white uppercase tracking-tight leading-none">{selectedRole}</h3>
                  <p className="text-[9px] font-bold text-[#4f46e5] uppercase tracking-widest mt-1">Ingresa tus credenciales</p>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl">
                <div className="flex flex-col items-center mb-10">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl mb-4 overflow-hidden p-3">
                    {branding?.logo_url && <img src={getDirectUrl(branding.logo_url)} className="w-full h-full object-contain" alt="Logo" />}
                  </div>
                  <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">LAS PALMAS</h1>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-4">
                    {/* SUCURSAL */}
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                        <Building2 size={18} />
                      </div>
                      <select
                        value={selectedBranchId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedBranchId(val);
                          // DISPARO AUTOMÁTICO DE PIN AL SELECCIONAR (SOLO MESERO)
                          if (selectedRole === 'MESERO' && val) {
                            setPin('');
                            setShowPinPad(true);
                          }
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-white outline-none focus:border-[#4f46e5] transition-all appearance-none"
                        required
                      >
                        <option value="" className="bg-[#1a1b23]">SELECCIONAR SUCURSAL</option>
                        {branches.map(b => <option key={b.id} value={b.id} className="bg-[#1a1b23]">{b.name}</option>)}
                      </select>
                    </div>

                    {/* CREDENCIALES ESTÁNDAR (USUARIO/PASSWORD) - OCULTO PARA MESEROS SI ES MÓVIL */}
                    {selectedRole !== 'MESERO' ? (
                      <>
                        {/* USUARIO */}
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                            <UserIcon size={18} />
                          </div>
                          <input
                            type="text"
                            inputMode="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-white placeholder:text-gray-600 outline-none focus:border-[#4f46e5] transition-all"
                            placeholder="NOMBRE DE USUARIO"
                            autoComplete="username"
                            required
                          />
                        </div>

                        {/* PASSWORD */}
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                            <ShieldCheck size={18} />
                          </div>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-white placeholder:text-gray-600 outline-none focus:border-[#4f46e5] transition-all"
                            placeholder="CONTRASEÑA"
                            autoComplete="current-password"
                            required
                          />
                        </div>
                      </>
                    ) : (
                      /* BOTÓN PARA ABRIR PIN PAD (SOLO MESEROS EN MÓVIL) */
                      selectedBranchId && (
                        <button
                          type="button"
                          onClick={() => {
                            setPin('');
                            setShowPinPad(true);
                          }}
                          className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black py-6 rounded-2xl text-[16px] shadow-2xl shadow-[#4f46e5]/40 active:scale-[0.95] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                          <Calculator size={24} />
                          <span>INGRESAR PIN</span>
                        </button>
                      )
                    )}
                  </div>

                  {error && (
                    <div className="py-3 px-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-black uppercase text-center rounded-xl animate-shake">
                      {error}
                    </div>
                  )}

                  {selectedRole !== 'MESERO' && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black py-4 rounded-2xl text-[13px] shadow-xl shadow-[#4f46e5]/20 active:scale-[0.98] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : 'INICIAR SESIÓN'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Versión Info */}
          <div className="mt-auto py-6 text-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">v1.3.1 - RESTAURANTE LAS PALMAS</span>
          </div>
        </div>

        {/* PIN PAD MODAL (MOBILE INTEGRATION) */}
        {showPinPad && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black p-4 animate-fade-in touch-none">
            <div className="w-full h-full max-w-sm bg-gradient-to-br from-[#2d2e3d] to-[#3a3b4d] rounded-[32px] border border-white/10 p-6 flex flex-col items-center justify-center shadow-2xl relative">
              <button
                onClick={() => {
                  setShowPinPad(false);
                  setPin('');
                }}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>

              <div className="mb-10 text-center">
                <div className="w-16 h-16 bg-[#4f46e5]/20 rounded-2xl flex items-center justify-center text-[#4f46e5] mx-auto mb-4 border border-[#4f46e5]/20">
                  <Users size={32} />
                </div>
                <h3 className="text-[20px] font-black text-white uppercase tracking-tighter">Ingrese su PIN</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Acceso para Meseros</p>
              </div>

              {/* PIN Indicator Dots */}
              <div className="flex gap-4 mb-12">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-[#4f46e5] scale-125 shadow-[0_0_20px_rgba(79,70,229,0.8)]' : 'bg-white/10 border border-white/5'}`}
                  ></div>
                ))}
              </div>

              {error && (
                <div className="mb-8 py-2 px-6 rounded-full bg-red-500/10 text-[10px] font-black text-red-500 uppercase tracking-widest animate-shake">
                  {error}
                </div>
              )}

              {/* Keypad Grid (Mobile Optimized) */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePinInput(num.toString())}
                    className="h-16 bg-white/5 active:bg-white/20 border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-black text-white transition-all active:scale-95 shadow-lg"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinInput('0')}
                  className="h-16 bg-white/5 active:bg-white/20 border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-black text-white transition-all active:scale-95 shadow-lg"
                >
                  0
                </button>
                <button
                  onClick={() => setPin(prev => prev.slice(0, -1))}
                  className="h-16 bg-red-500/10 active:bg-red-500/20 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 transition-all active:scale-95 shadow-lg"
                >
                  <Delete size={28} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent font-sans relative overflow-hidden">


      {/* Main Container updated width for Dashboard */}
      {/* Main Container updated width for Dashboard */}
      <div className={`relative z-10 w-full ${showRegisterSelection ? 'w-screen h-screen rounded-none' : 'max-w-3xl h-[480px] rounded-[40px]'} bg-gradient-to-br from-[#2d2e3d] to-[#3a3b4d] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex overflow-hidden transition-all duration-700 login-card animate-fade-in`}>

        {/* CONTROLES NATIVOS (SOLO VISIBLE SI ELECTRON ESTÁ PRESENTE) */}
        <div className="absolute top-4 right-6 z-[100] flex items-center gap-2">
          <button
            onClick={() => (window as any).electronAPI?.minimizeWindow()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
            title="Minimizar"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => (window as any).electronAPI?.closeWindow()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all active:scale-95 group"
            title="Cerrar"
          >
            <X size={16} className="group-hover:stroke-[3]" />
          </button>
        </div>

        {showRegisterSelection ? (
          <div className="w-full h-full flex flex-col p-10 bg-[#2d2e3d] backdrop-blur-md animate-fade-in relative z-20">
            {/* Header Dashboard Style */}
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    localStorage.removeItem('operatorDashboardLead');
                    setShowRegisterSelection(false);
                    if ((window as any).electronAPI) (window as any).electronAPI.sendLogout();
                  }}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-lg group"
                >
                  <ArrowLeft size={18} className="group-hover:text-indigo-400" />
                </button>
                <div>
                  <h4 className="text-[12px] font-black text-white uppercase tracking-[0.3em] leading-none">RESTAURANTE LAS PALMAS POS</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-2">DASHBOARD DE OPERADORES</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-3 justify-end">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-500/10">0 Ordenes Asignadas</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{authenticatedUser?.name}</span>
                    <span className="text-[7px] font-bold text-green-500 uppercase tracking-[0.2em] mt-0.5">Acceso Autorizado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Grid - Scrollable area for many operators */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full max-w-7xl mx-auto">
                {/* SIEMPRE MOSTRAR AL USUARIO ACTUAL CON SU NOMBRE */}
                <button
                  type="button"
                  onClick={() => handleOperatorClick(authenticatedUser)}
                  className="flex flex-col items-center justify-center gap-4 p-8 bg-[#23242f] border-2 border-indigo-500/40 rounded-3xl hover:bg-indigo-600/20 hover:border-indigo-500/60 transition-all group relative shadow-2xl hover:-translate-y-1"
                >
                  <div className={`w-2.5 h-2.5 rounded-full absolute top-4 left-4 ${openShiftUserIds.includes(authenticatedUser?.id) ? 'bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.9)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]'}`}></div>
                  <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300 transition-colors shadow-inner border border-white/5">
                    <CashRegisterIcon size={40} strokeWidth={1} />
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] font-black text-white uppercase tracking-widest block truncate max-w-[160px]">{authenticatedUser?.name || 'MI TERMINAL'}</span>
                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-1">CAJA PRINCIPAL</span>
                  </div>
                </button>

                {/* Mostrar el resto de personal autorizado (Cajeros, Admins y Meseros con permiso) */}
                {registerList.filter(r => r.id !== authenticatedUser?.id).map(reg => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleOperatorClick(reg)}
                    className="flex flex-col items-center justify-center gap-4 p-8 bg-[#23242f] border border-white/5 rounded-3xl hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all group relative shadow-2xl hover:-translate-y-1"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full absolute top-4 left-4 ${openShiftUserIds.includes(reg.id) ? 'bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.9)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]'}`}></div>
                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-indigo-400 transition-colors shadow-inner">
                      <CashRegisterIcon size={40} strokeWidth={1} />
                    </div>
                    <div className="text-center">
                      <span className="text-[12px] font-black text-white uppercase tracking-widest block truncate max-w-[140px]">{reg.name}</span>
                      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-1">Operador Multifunción</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 border-t border-white/5 pt-8">
              <button
                type="button"
                onClick={() => onRefreshMenu?.('config')}
                disabled={isSyncing}
                className={`w-52 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 hover:text-white hover:bg-white/10 ${isSyncing ? 'opacity-50' : ''}`}
              >
                {syncType === 'config' ? 'ACTUALIZANDO...' : 'ACTUALIZAR CONFIGURACIÓN'}
              </button>
              <button
                type="button"
                onClick={() => onRefreshMenu?.('images')}
                disabled={isSyncing}
                className={`w-52 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 hover:text-white hover:bg-white/10 ${isSyncing ? 'opacity-50' : ''}`}
              >
                {syncType === 'images' ? 'ACTUALIZANDO...' : 'ACTUALIZAR IMÁGENES'}
              </button>
              <button
                type="button"
                onClick={() => setShowCloseDayModal(true)}
                className={`w-52 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 hover:text-red-500 hover:border-red-500/30 hover:bg-white/10`}
              >
                CIERRE DEL DÍA
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* LEFT PANEL: FORM - ANCHO REDUCIDO (380px) Y COLOR PERSONALIZADO */}
            <div className="w-[380px] flex-shrink-0 flex flex-col p-10 relative z-20 bg-gradient-to-br from-[#2d2e3d]/80 to-[#3a3b4d]/80 backdrop-blur-md border-r border-white/5 shadow-2xl transition-all duration-500 overflow-hidden">
              {/* Reflejos de Luz para el Gradiente */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-3xl -mr-32 -mt-32 rounded-full pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 blur-3xl -ml-32 -mb-32 rounded-full pointer-events-none"></div>
              {/* Logo Section */}
              <div className="mb-2 flex flex-col items-center -mt-4">
                <div className="relative group mb-1">
                  <div className="absolute -inset-6 bg-indigo-500/20 blur-2xl rounded-full opacity-40"></div>
                  <div className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl overflow-hidden shadow-indigo-500/20">
                    {branding?.logo_url && (
                      <img
                        src={getDirectUrl(branding.logo_url)}
                        className="w-full h-full object-contain scale-[1.2] transition-transform duration-500 group-hover:scale-[1.35]"
                        alt="Logo"
                      />
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[7.5px] font-bold text-gray-500 tracking-[0.4em] uppercase">Restaurante</span>
                  <h1 className="text-lg font-black text-white tracking-tighter leading-none mt-1 font-outfit">LAS PALMAS</h1>
                  <p className="text-[7px] font-black text-indigo-400 tracking-[0.5em] mt-1 uppercase">Sistema POS</p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="w-full max-w-sm mx-auto space-y-4">
                <div className="space-y-3">
                  {/* BRANCH SELECTION */}
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400">
                      <Building2 size={14} />
                    </div>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-8 pr-4 text-[8px] font-black text-white outline-none focus:border-indigo-500 focus:bg-black/60 transition-all uppercase tracking-normal"
                      required
                    >
                      <option value="" className="bg-[#2d2e3d]">--- SELECCIONAR SUCURSAL ---</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id} className="bg-[#2d2e3d] text-white py-2">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400">
                      <UserIcon size={14} />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:bg-black/60 transition-all tracking-widest"
                      placeholder="USUARIO"
                      required
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400">
                      <ShieldCheck size={14} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:border-indigo-500 focus:bg-black/60 transition-all tracking-widest"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/15 border border-red-500/30 text-white text-[11px] font-black uppercase text-center py-3 px-4 rounded-xl animate-shake tracking-wide shadow-lg shadow-red-950/20">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white font-black py-2.5 rounded-xl text-[10px] shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : 'Iniciar Sesión'}
                </button>
              </form>

              {/* Footer Info */}
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-500 tracking-widest uppercase">Versión 1.3.1</span>
                </div>
                <button className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all">
                  <LogOut size={12} />
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: IMAGE & ROLES GRID - TAMAÑO COMPLETO Y CENTRADO EN BASE AZUL CORPORATIVO CON ESQUINAS REDONDEADAS */}
            <div className="flex-1 relative overflow-hidden bg-[#2d2e3d] flex flex-col z-20 items-center justify-center rounded-r-[40px]">
              {/* IMAGEN DE FONDO SOLO PARA ESTE PANEL - TAMAÑO COMPLETO */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {branding?.login_background_url && (
                  <img
                    src={getDirectUrl(branding.login_background_url)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                    alt="Background"
                  />
                )}
              </div>

              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-5">
                <span className="text-[9px] font-black text-white uppercase tracking-[0.4em] mb-4 drop-shadow-md">Selecciona tu Perfil</span>

                {/* Roles Grid - DISTRIBUCION 2 - 2 - 1 */}
                <div className="grid grid-cols-2 gap-3 w-fit mx-auto">
                  {[
                    { id: 'CAJERO', icon: <CashRegisterIcon size={20} />, label: 'Cajero' },
                    { id: 'MESERO', icon: <Users size={20} />, label: 'Mesero' },
                    { id: 'COCINA', icon: <ChefHat size={20} />, label: 'KDS' },
                    { id: 'ADMIN', icon: <ShieldCheck size={20} />, label: 'Admin' },
                    { id: 'PRODUCCION', icon: <Layers size={20} />, label: 'Producción', centered: true }
                  ].map(role => {
                    const isSelected = selectedRole === role.id;
                    const buttonElement = (
                      <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role.id as UserRole)}
                        className={`w-[160px] flex items-center justify-center gap-2 p-3 border transition-all group active:scale-95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl ${isSelected
                          ? 'bg-indigo-600 border-indigo-400 ring-4 ring-indigo-500/20'
                          : 'bg-black/40 border-white/20 hover:bg-black/60 shadow-xl'
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${isSelected
                          ? 'bg-white text-indigo-600'
                          : 'bg-white/5 text-indigo-400 group-hover:bg-white/10 group-hover:text-white'
                          }`}>
                          {role.icon}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {role.label}
                        </span>
                      </button>
                    );

                    if (role.centered) {
                      return (
                        <div key={role.id} className="col-span-2 flex justify-center py-2">
                          {buttonElement}
                        </div>
                      );
                    }
                    return buttonElement;
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* PIN PAD MODAL (SOLO PARA MESEROS) */}
      {showPinPad && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-4 animate-fade-in touch-none">
          <div className="w-full max-w-sm bg-gradient-to-br from-[#2d2e3d] to-[#3a3b4d] rounded-[32px] border border-white/10 p-6 flex flex-col items-center shadow-2xl relative">
            <button
              onClick={() => setShowPinPad(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="mb-6 text-center">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mx-auto mb-3 border border-indigo-500/20">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Ingrese su PIN</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Acceso para Meseros</p>
            </div>

            {/* PIN Indicator Dots */}
            <div className="flex gap-3 mb-8">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-indigo-500 scale-125 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-white/10 border border-white/5'}`}
                ></div>
              ))}
            </div>

            {error && (
              <div className="mb-6 py-2 px-4 rounded-full bg-red-500/10 text-[9px] font-black text-red-400 uppercase tracking-widest animate-shake">
                {error}
              </div>
            )}

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-2 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handlePinInput(num.toString())}
                  className="h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-lg font-bold text-white transition-all active:scale-90"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinInput('0')}
                className="h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-lg font-bold text-white transition-all active:scale-90"
              >
                0
              </button>
              <button
                onClick={() => setPin(prev => prev.slice(0, -1))}
                className="h-12 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 transition-all active:scale-90"
              >
                <Delete size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CIERRE DEL DÍA (IMPLEMENTACIÓN BASADA EN REFERENCIA) */}
      {showCloseDayModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-[#2d2e3d] rounded-2xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row">
            {/* IZQUIERDA: GRILLA DE CAJAS */}
            <div className="flex-[1.5] p-8 border-r border-white/5">
              <div className="bg-[#1a1b23] p-3 rounded-lg text-center mb-8 border border-white/5 shadow-inner">
                <span className="text-white font-black text-sm uppercase tracking-[0.3em]">Cajas</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* BOTÓN TODAS LAS CAJAS */}
                <button
                  onClick={() => setSelectedRegisterForClose('ALL')}
                  className={`h-20 border rounded-xl flex items-center justify-center p-4 transition-all group overflow-hidden relative ${selectedRegisterForClose === 'ALL' ? 'bg-indigo-600/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-[#23242f] border-white/5 hover:bg-white/10'}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent transition-opacity ${selectedRegisterForClose === 'ALL' ? 'opacity-100' : 'opacity-0'}`}></div>
                  <span className={`font-black text-xs uppercase tracking-widest relative z-10 text-center ${selectedRegisterForClose === 'ALL' ? 'text-white' : 'text-gray-400'}`}>Todas las Cajas</span>
                </button>

                {/* BOTÓN PRINCIPAL (USUARIO ACTUAL) */}
                <button
                  onClick={() => setSelectedRegisterForClose(authenticatedUser?.id)}
                  className={`h-20 border rounded-xl flex items-center justify-center p-4 transition-all text-center ${selectedRegisterForClose === authenticatedUser?.id ? 'bg-indigo-600/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-[#23242f] border-white/5 hover:bg-white/10'}`}
                >
                  <span className={`font-bold text-xs uppercase tracking-widest leading-tight ${selectedRegisterForClose === authenticatedUser?.id ? 'text-white' : 'text-gray-400'}`}>{authenticatedUser?.name || 'PRINCIPAL'}</span>
                </button>

                {/* BOTONES AUTOMÁTICOS DE CAJEROS, ADMINS Y MESEROS CON PERMISO */}
                {registerList.filter(r => r.id !== authenticatedUser?.id).map(reg => (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedRegisterForClose(reg.id)}
                    className={`h-20 border rounded-xl flex items-center justify-center p-4 transition-all text-center ${selectedRegisterForClose === reg.id ? 'bg-indigo-600/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-[#23242f] border-white/5 hover:bg-white/10'}`}
                  >
                    <span className={`font-bold text-xs uppercase tracking-widest leading-tight ${selectedRegisterForClose === reg.id ? 'text-white' : 'text-gray-400'}`}>{reg.name}</span>
                  </button>
                ))}
              </div>

              <p className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">
                *En el reporte aparecerán únicamente los Turnos ya cerrados.
              </p>
            </div>

            {/* DERECHA: ACCIONES Y FECHA */}
            <div className="flex-1 p-8 bg-[#1a1b23]/30 flex flex-col justify-center items-center gap-8">
              {/* SELECTOR DE FECHA */}
              <div className="w-full text-center">
                <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.4em] mb-4">FECHA</label>
                <div className="relative group mx-auto max-w-[200px]">
                  <input
                    type="date"
                    value={selectedCloseDate}
                    onChange={(e) => setSelectedCloseDate(e.target.value)}
                    className="w-full h-12 bg-[#23242f] border border-white/10 rounded-lg px-4 text-white font-black text-sm uppercase tracking-widest outline-none focus:border-indigo-500/50 transition-all text-center custom-calendar-picker"
                  />
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="w-full space-y-4 max-w-[240px]">
                <button
                  onClick={handlePrintReport}
                  className="w-full h-14 bg-[#23242f] border-r-4 border-yellow-500 rounded-xl flex items-center justify-center text-white font-black text-[11px] uppercase tracking-[0.3em] hover:bg-white/5 transition-all shadow-xl active:scale-95"
                >
                  IMPRIMIR
                </button>

                <button
                  onClick={handleSendEmailReport}
                  className="w-full h-14 bg-[#23242f] border-r-4 border-blue-500 rounded-xl flex items-center justify-center text-white font-black text-[11px] uppercase tracking-[0.3em] hover:bg-white/5 transition-all shadow-xl active:scale-95"
                >
                  ENVIAR CORREO
                </button>

                <button
                  onClick={() => {
                    setShowCloseDayModal(false);
                    setSelectedRegisterForClose('ALL');
                  }}
                  className="w-full h-14 bg-[#23242f] border-r-4 border-red-500 rounded-xl flex items-center justify-center text-white font-black text-[11px] uppercase tracking-[0.3em] hover:bg-white/5 transition-all shadow-xl active:scale-95"
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
