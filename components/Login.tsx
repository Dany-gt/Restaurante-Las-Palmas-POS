import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../supabase';
import { ArrowLeft, Loader2, User as UserIcon, Building2, Calculator, Users, ChefHat, ShieldCheck, Check, Delete, X, Settings, LogOut, Minus, Layers, Eye, EyeOff } from 'lucide-react';
import { activityLogService } from '../services/ActivityLogService';
import { getImageUrl } from '../utils/getImageUrl';

import { CajaIcon } from './CajaIcon';
import { PrinterSelector } from './PrinterSelector';
import { AppUpdater } from './AppUpdater';
import packageJson from '../package.json';

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
  const [showPassword, setShowPassword] = useState(false);
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
  const [boxLockedError, setBoxLockedError] = useState<string | null>(null);

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
    return getImageUrl(url);
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

            // Lógica de Autoselección (prioriza la sucursal del operador logueado)
            const cachedLead = localStorage.getItem('operatorDashboardLead');
            let initialBranchId = '';
            if (cachedLead) {
              try {
                const user = JSON.parse(cachedLead);
                if (user.branch_id) {
                  initialBranchId = user.branch_id;
                }
              } catch (e) { }
            }

            if (initialBranchId) {
              setSelectedBranchId(initialBranchId);
            } else {
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
    setPin(prev => prev + num);
  };

  const fetchAuthorizedProfiles = useCallback(async (branchId: string) => {
    if (!branchId) {
      console.warn('[Login] fetchAuthorizedProfiles: branchId vacío, abortando.');
      return;
    }

    console.log('[Login] Obteniendo cajas para sucursal:', branchId);

    // Asegurar que la sesión de Supabase esté activa antes de consultar
    // (el cliente puede no haberla restaurado aún tras un remount)
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Login] Sin sesión activa, intentando refrescar...');
      try {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      } catch (e) {
        console.error('[Login] No se pudo refrescar la sesión:', e);
      }
    }
    console.log('[Login] Estado de sesión:', session ? '✅ Activa' : '❌ Sin sesión');

    // Fetch active cash registers for the branch
    const { data: registers, error: regError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name');

    console.log('[Login] Cajas encontradas:', registers?.length ?? 0, regError ? `Error: ${regError.message}` : '');

    if (registers && registers.length > 0) {
      // Cachear en localStorage para restauración inmediata en el próximo remount
      localStorage.setItem('cached_register_list', JSON.stringify(registers));
      setRegisterList(registers);
    }
    // NOTA: Si la consulta devuelve vacío, NO limpiamos la lista
    // para preservar los datos cacheados que ya se restauraron.

    // Si no hay cajas pero hay sesión activa, reintenta una vez después de 800ms
    if ((!registers || registers.length === 0) && session) {
      console.warn('[Login] Lista vacía con sesión activa — reintentando en 800ms...');
      setTimeout(async () => {
        const { data: retryRegisters } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .order('name');
        console.log('[Login] Reintento — Cajas encontradas:', retryRegisters?.length ?? 0);
        if (retryRegisters && retryRegisters.length > 0) {
          setRegisterList(retryRegisters);
        }
      }, 800);
    }

    // Track which registers have an open shift (by cash_register_id)
    const { data: openShifts } = await supabase
      .from('shifts')
      .select('cash_register_id')
      .is('end_time', null);

    if (openShifts) {
      setOpenShiftUserIds(openShifts.map(s => s.cash_register_id).filter(Boolean));
    }
  }, []);


  const handleLoginSuccess = async (user: any) => {
    setAuthenticatedUser(user);
    localStorage.setItem('operatorDashboardLead', JSON.stringify(user));
    setShowRegisterSelection(true);
    if ((window as any).electronAPI) (window as any).electronAPI.sendLoginSuccess();
    await fetchAuthorizedProfiles(selectedBranchId);
  };

  // AUTO-SHOW: Restaura el panel de cajas tras un soft logout / remount
  useEffect(() => {
    const cachedLead = localStorage.getItem('operatorDashboardLead');
    if (!cachedLead) return;

    try {
      const user = JSON.parse(cachedLead);
      setAuthenticatedUser(user);
      setShowRegisterSelection(true);

      // Si el usuario tiene una sucursal asignada, nos aseguramos de usarla
      if (user.branch_id && selectedBranchId !== user.branch_id) {
        console.log('[Login] Ajustando selectedBranchId al del operador:', user.branch_id);
        setSelectedBranchId(user.branch_id);
        return;
      }

      // 1. Mostrar cajas desde localStorage inmediatamente (sin esperar a Supabase)
      const cachedRegs = localStorage.getItem('cached_register_list');
      if (cachedRegs) {
        const regs = JSON.parse(cachedRegs);
        if (regs.length > 0) {
          console.log('[Login] ✅ Cajas restauradas desde caché:', regs.length);
          setRegisterList(regs);
        }
      }

      // 2. Re-fetch en background cuando tengamos el branchId para datos frescos
      if (selectedBranchId) {
        fetchAuthorizedProfiles(selectedBranchId);
      }
    } catch (e) {
      console.error('[Login] Error restaurando sesión de operador:', e);
    }
  }, [selectedBranchId, fetchAuthorizedProfiles]);

  const handleLogin = async (e?: React.FormEvent, pinFromPad?: string) => {
    if (e) e.preventDefault();
    const currentPass = pinFromPad || password;
    const currentUser = pinFromPad ? '' : username;

    if (!pinFromPad && (!username || !password)) {
      setError('Datos incompletos');
      return;
    }
    if (!selectedRole && !selectedProfileForPin) {
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
      // 0. Validación Dashboard de Operadores (Login por PIN en caja seleccionada)
      if (pinFromPad && selectedProfileForPin) {
        // Look up user by PIN or Password (some admins use numerical passwords)
        const { data: profilesByPin, error: pinErr } = await supabase
          .from('profiles')
          .select('*')
          .or(`pin.eq."${pinFromPad}",password.eq."${pinFromPad}"`);

        console.log('[DEBUG PIN] Búsqueda de PIN o Pass:', pinFromPad);
        console.log('[DEBUG PIN] Resultado DB:', profilesByPin);
        if (pinErr) console.error('[DEBUG PIN] Error DB:', pinErr);

        // Encontrar perfil que coincida con la sucursal, o que tenga branch_id null (Admin/Multi-sucursal)
        const profileByPin = profilesByPin?.find(p => !p.branch_id || p.branch_id === selectedBranchId);

        if (profileByPin) {
          // --- VALIDAR SI LA CAJA YA TIENE UN TURNO ABIERTO POR OTRO USUARIO ---
          const { data: activeShifts, error: shiftErr } = await supabase
            .from('shifts')
            .select(`
              cashier_id,
              profiles (name)
            `)
            .eq('cash_register_id', selectedProfileForPin.id)
            .is('end_time', null)
            .limit(1);

          if (shiftErr) {
            console.error('[DEBUG PIN] Error al verificar turnos activos:', shiftErr);
          }

          if (activeShifts && activeShifts.length > 0) {
            const activeShift = activeShifts[0];
            if (activeShift.cashier_id !== profileByPin.id) {
              // El cajero activo es diferente. Bloquear y mostrar error.
              const profilesArray = activeShift.profiles as any;
              const activeCashierName = (Array.isArray(profilesArray) ? profilesArray[0]?.name : profilesArray?.name) || 'otro usuario';
              setBoxLockedError(`Esta caja fue aperturada por el usuario ${activeCashierName.toUpperCase()}. No tiene permisos para operarla`);
              setPin('');
              setLoading(false);
              return;
            }
          }

          // Attach the selected register id to the session
          executeLogin({ ...profileByPin, cash_register_id: selectedProfileForPin.id });
          setPin('');
          setShowPinPad(false);
          setSelectedProfileForPin(null);
          return;
        } else {
          setError('PIN INCORRECTO');
          console.warn('[DEBUG PIN] No se encontró perfil válido para la sucursal o PIN incorrecto.');
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
          query = query.or(`pin.eq."${currentPass}",password.eq."${currentPass}"`);
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
      const isAdminEnteringAsCashier = user.role === 'ADMIN' && selectedRole === 'CAJERO';

      if ((user.role === 'CAJERO' && !isCashierEnteringAsWaiter) || isAdminEnteringAsCashier) {
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
        user: { id: '00000000-0000-0000-0000-000000000000', name: username || 'Pad User', role: selectedRole } as any,
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
                <h2 className="text-[24px] font-semibold text-white tracking-tighter uppercase leading-none mb-2">BIENVENIDO</h2>
                <div className="w-12 h-1 bg-white rounded-full mx-auto mb-6" />
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.3em]">Selecciona tu Perfil</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto w-full">
                {[
                  { id: 'CAJERO', icon: <CajaIcon size={24} />, label: 'Cajero' },
                  { id: 'MESERO', icon: <Users size={24} />, label: 'Mesero' },
                  { id: 'COCINA', icon: <ChefHat size={24} />, label: 'KDS' },
                  { id: 'ADMIN', icon: <ShieldCheck size={24} />, label: 'Admin' },
                  { id: 'PRODUCCION', icon: <Layers size={24} />, label: 'Producción', fullWidth: true }
                ].map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id as UserRole)}
                    className={`flex flex-col items-center justify-center p-5 rounded-[24px] transition-all active:scale-95 border shadow-2xl backdrop-blur-md
                        ${role.fullWidth ? 'col-span-2 aspect-[2.2/1]' : 'aspect-square'}
                        ${selectedRole === role.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}
                      `}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-colors ${selectedRole === role.id ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40'}`}>
                      {role.icon}
                    </div>
                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${selectedRole === role.id ? 'text-white' : 'text-white/60'}`}>{role.label}</span>
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
                  <h3 className="text-[16px] font-semibold text-white uppercase tracking-tight leading-none">{selectedRole}</h3>
                  <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest mt-1">Ingresa tus credenciales</p>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl">
                <div className="flex flex-col items-center mb-10">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl mb-4 overflow-hidden p-3">
                    {branding?.logo_url && <img src={getDirectUrl(branding.logo_url)} className="w-full h-full object-contain" alt="Logo" />}
                  </div>
                  <h1 className="text-xl font-semibold text-white tracking-tighter uppercase leading-none">LAS PALMAS</h1>
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
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-medium text-white outline-none focus:border-white transition-all appearance-none"
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
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base font-medium text-white placeholder:text-gray-600 outline-none focus:border-white transition-all"
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
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-base font-medium text-white placeholder:text-gray-600 outline-none focus:border-white transition-all"
                            placeholder="CONTRASEÑA"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors focus:outline-none"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
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
                          className="w-full bg-white hover:bg-white/90 text-black font-semibold py-6 rounded-2xl text-[16px] shadow-2xl shadow-white/10 active:scale-[0.95] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                          <Calculator size={24} />
                          <span>INGRESAR PIN</span>
                        </button>
                      )
                    )}
                  </div>

                  {error && (
                    <div className="py-3 px-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-semibold uppercase text-center rounded-xl animate-shake">
                      {error}
                    </div>
                  )}

                  {selectedRole !== 'MESERO' && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-2xl text-[13px] shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin text-white" size={20} /> : 'INICIAR SESIÓN'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Versión Info */}
          <div className="mt-auto py-6 text-center">
            <span className="text-[10px] font-medium text-gray-600 uppercase tracking-widest">v{packageJson.version} - RESTAURANTE LAS PALMAS</span>
          </div>
        </div>

        {/* PIN PAD MODAL (MOBILE INTEGRATION) */}
        {showPinPad && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-4 animate-fade-in touch-none">
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
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 border border-white/20">
                  <Users size={32} />
                </div>
                <h3 className="text-[20px] font-semibold text-white uppercase tracking-tighter">Ingrese su PIN</h3>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mt-1">Acceso para Meseros</p>
              </div>

              {/* PIN Indicator Dots */}
              <div className="flex gap-4 mb-12">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-white scale-125 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-white/10 border border-white/5'}`}
                  ></div>
                ))}
              </div>

              {error && (
                <div className="mb-8 py-2 px-6 rounded-full bg-red-500/10 text-[10px] font-semibold text-red-500 uppercase tracking-widest animate-shake">
                  {error}
                </div>
              )}

              {/* Keypad Grid (Mobile Optimized) */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePinInput(num.toString())}
                    className="h-16 bg-white/5 active:bg-white/20 border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-semibold text-white transition-all active:scale-95 shadow-lg"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinInput('0')}
                  className="h-16 bg-white/5 active:bg-white/20 border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-semibold text-white transition-all active:scale-95 shadow-lg"
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
    <div className="min-h-screen flex sm:items-center justify-center items-start pt-8 sm:pt-0 bg-transparent font-sans relative overflow-hidden">


      {/* Main Container updated width for Dashboard */}
      <div className={`relative z-10 w-full ${showRegisterSelection ? 'w-screen h-screen rounded-none' : 'max-w-3xl min-h-[480px] sm:h-[480px] rounded-[4px]'} bg-gradient-to-br from-[#2d2e3d] to-[#3a3b4d] border border-white/10 shadow-2xl flex flex-col sm:flex-row overflow-hidden login-card animate-fade-in mx-4 sm:mx-0`}>

        {/* CONTROLES NATIVOS (SOLO VISIBLE SI ELECTRON ESTÁ PRESENTE O PWA) */}
        <div className="absolute top-4 right-6 z-[100] flex items-center gap-2">
          <button
            onClick={() => {
              if ((window as any).electronAPI) {
                (window as any).electronAPI.minimizeWindow();
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
            title="Minimizar"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => {
              if ((window as any).electronAPI) {
                (window as any).electronAPI.closeWindow();
              } else {
                // Intento de cerrar la PWA en Android o navegador
                window.close();
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all active:scale-95 group"
            title="Cerrar"
          >
            <X size={16} className="group-hover:stroke-[3]" />
          </button>
        </div>

        {showRegisterSelection ? (
          <div className="w-full h-full flex flex-col bg-[#2d2e3d] animate-fade-in relative z-20">
            {/* Header compacto */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem('operatorDashboardLead');
                    setShowRegisterSelection(false);
                    setAuthenticatedUser(null);
                    setRegisterList([]);
                    setSelectedRole('');
                    setUsername('');
                    setPassword('');
                    setLoginStep('ROLE');
                    setError('');
                    if ((window as any).electronAPI) (window as any).electronAPI.sendLogout();
                  }}
                  className="w-14 h-14 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <ArrowLeft size={26} strokeWidth={2.5} />
                </button>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.25em]">RESTAURANTE LAS PALMAS POS</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">0 Ordenes Asignadas</span>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-semibold text-white uppercase tracking-widest leading-none">{authenticatedUser?.name}</span>
                  <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest mt-0.5">Cajas</span>
                </div>
              </div>
            </div>

            {/* Dashboard Grid - Tarjetas horizontales centradas */}
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="flex flex-wrap justify-center gap-3 w-full max-w-7xl">
                {registerList.map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleOperatorClick(reg)}
                    className="flex items-center gap-3 w-[283px] h-[90px] flex-shrink-0 bg-[#23242f] border border-white/10 rounded-xl px-4 hover:bg-white/10 hover:border-white/25 transition-all group shadow-md active:scale-[0.97]"
                  >
                    {/* Dot indicador */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${openShiftUserIds.includes(reg.id)
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                      }`} />
                    {/* Icono caja */}
                    <div className="text-gray-400 group-hover:text-white transition-colors flex-shrink-0">
                      <CajaIcon size={50} />
                    </div>
                    {/* Nombre */}
                    <span className="text-[14px] font-semibold text-white uppercase tracking-wider text-left whitespace-nowrap">
                      {reg.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center px-8 py-4 border-t border-white/5 flex-shrink-0">
              <div className="flex flex-wrap justify-center gap-4 w-full max-w-5xl">
                <AppUpdater />
                <button
                  type="button"
                  onClick={() => onRefreshMenu?.('config')}
                  disabled={isSyncing}
                  className={`w-[150px] h-[56px] bg-[#23242f] border border-white/10 rounded-none px-3 transition-all group shadow-md active:scale-[0.97] flex items-center justify-center relative overflow-hidden ${isSyncing ? 'opacity-50' : 'hover:bg-white/10 hover:border-white/25'}`}
                >
                  {/* Pestañita azul en la esquina superior derecha */}
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-blue-500 border-l-[10px] border-l-transparent pointer-events-none" />

                  <span className="text-[9.5px] font-semibold text-gray-400 group-hover:text-white uppercase tracking-wider text-center transition-colors leading-tight">
                    {syncType === 'config' ? 'ACTUALIZANDO...' : 'ACTUALIZAR CONFIGURACIÓN'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRefreshMenu?.('images')}
                  disabled={isSyncing}
                  className={`w-[150px] h-[56px] bg-[#23242f] border border-white/10 rounded-none px-3 transition-all group shadow-md active:scale-[0.97] flex items-center justify-center relative overflow-hidden ${isSyncing ? 'opacity-50' : 'hover:bg-white/10 hover:border-white/25'}`}
                >
                  {/* Pestañita azul en la esquina superior derecha */}
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-blue-500 border-l-[10px] border-l-transparent pointer-events-none" />

                  <span className="text-[9.5px] font-semibold text-gray-400 group-hover:text-white uppercase tracking-wider text-center transition-colors leading-tight">
                    {syncType === 'images' ? 'ACTUALIZANDO...' : 'ACTUALIZAR IMÁGENES DE MENÚ'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseDayModal(true)}
                  className="w-[150px] h-[56px] bg-[#23242f] border border-white/10 rounded-none px-3 hover:bg-red-500/10 hover:border-red-500/20 transition-all group shadow-md active:scale-[0.97] flex items-center justify-center relative overflow-hidden"
                >
                  {/* Pestañita azul en la esquina superior derecha */}
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-blue-500 border-l-[10px] border-l-transparent pointer-events-none" />

                  <span className="text-[9.5px] font-semibold text-gray-400 group-hover:text-red-400 uppercase tracking-wider text-center transition-colors leading-tight">
                    CIERRE DEL DÍA
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* LEFT PANEL: LOGIN FORM (Sin transición y con forced GPU comp para evitar glitch de estática) */}
            <div
              className="w-full sm:w-[380px] flex-shrink-0 flex flex-col p-6 sm:p-10 relative z-20 bg-[#23242f] border-b sm:border-b-0 sm:border-r border-white/5 rounded-t-[4px] sm:rounded-t-none sm:rounded-l-[4px]"
              style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', willChange: 'transform' }}
            >
              {/* Logo Section */}
              <div className="mb-2 flex flex-col items-center -mt-4">
                <div className="relative group mb-1">
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
                  <span className="text-[7.5px] font-medium text-gray-500 tracking-[0.4em] uppercase">Restaurante</span>
                  <h1 className="text-lg font-semibold text-white tracking-tighter leading-none mt-1 font-outfit">LAS PALMAS</h1>
                  <p className="text-[7px] font-semibold text-white/40 tracking-[0.5em] mt-1 uppercase">Sistema POS</p>
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
                      className="w-full bg-[#15161d] border border-white/10 rounded-xl py-2.5 pl-8 pr-4 text-[8px] font-semibold text-white outline-none focus:border-indigo-500 uppercase tracking-normal"
                      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
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
                      className="w-full bg-[#15161d] border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[11px] font-medium text-white placeholder:text-gray-500 outline-none focus:border-white tracking-widest"
                      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                      placeholder="USUARIO"
                      required
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400">
                      <ShieldCheck size={14} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#15161d] border border-white/10 rounded-xl py-2.5 pl-9 pr-9 text-[11px] font-medium text-white placeholder:text-gray-500 outline-none focus:border-indigo-500 tracking-widest"
                      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/15 border border-red-500/30 text-white text-[11px] font-semibold uppercase text-center py-3 px-4 rounded-xl animate-shake tracking-wide shadow-lg shadow-red-950/20">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-[10px] shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : 'Iniciar Sesión'}
                </button>
              </form>

              {/* Footer Info */}
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-semibold text-gray-500 tracking-widest uppercase">Versión {packageJson.version}</span>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: IMAGE & ROLES GRID - TAMAÑO COMPLETO Y CENTRADO EN BASE AZUL CORPORATIVO CON ESQUINAS REDONDEADAS */}
            <div className="flex-1 relative overflow-hidden bg-[#2d2e3d] flex flex-col z-20 items-center justify-center rounded-r-[4px]">
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
                <span className="text-[9px] font-semibold text-white uppercase tracking-[0.4em] mb-4 drop-shadow-md">Selecciona tu Perfil</span>

                {/* Roles Grid - DISTRIBUCION 2 - 2 - 1 */}
                <div className="grid grid-cols-2 gap-3 w-fit mx-auto">
                  {[
                    { id: 'CAJERO', icon: <CajaIcon size={20} />, label: 'Cajero' },
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
                        className={`w-[160px] flex items-center justify-center gap-2 p-3 border transition-all group active:scale-95 shadow-xl rounded-2xl ${isSelected
                          ? 'bg-indigo-600 border-indigo-500 ring-4 ring-indigo-500/20'
                          : 'bg-black/40 border-white/10 hover:bg-black/60'
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${isSelected
                          ? 'bg-white text-indigo-600'
                          : 'bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white'
                          }`}>
                          {role.icon}
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 animate-fade-in touch-none">
          <div className="w-full max-w-[737px] h-[453px] bg-[#2e303f] rounded-[4px] border border-white/10 flex flex-col md:flex-row relative shadow-lg overflow-hidden">
            {/* Close Button inside top-right (classic Windows style) */}
            <button
              onClick={() => {
                setShowPinPad(false);
                setPin('');
                setError('');
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-[4px] bg-transparent hover:bg-red-600 flex items-center justify-center text-white/60 hover:text-white transition-all z-[110]"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* IZQUIERDA: LOGO Y FONDO DE RESTAURANTE */}
            <div className="relative w-full md:w-[45%] h-full bg-[#23242f] rounded-l-[4px] flex flex-col items-center justify-center p-8 overflow-hidden flex-shrink-0">
              {/* Background Image with Dark Overlay */}
              {branding?.login_background_url && (
                <img
                  src={getDirectUrl(branding.login_background_url)}
                  className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale"
                  alt="Background"
                />
              )}
              {/* Center Logo Content */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
                <span className="text-white text-[13px] font-medium uppercase tracking-[0.15em] font-sans text-white/60">Restaurante</span>
                <span className="text-white text-2xl font-medium tracking-wide font-serif mt-1 mb-2 leading-none">Las Palmas</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-[2px] bg-red-500"></div>
                  <span className="text-white text-xs font-medium uppercase tracking-[0.2em]">POS</span>
                  <div className="w-6 h-[2px] bg-red-500"></div>
                </div>
              </div>
              {/* Bottom Text */}
              <p className="absolute bottom-4 left-0 right-0 text-[10px] text-white/40 text-center font-normal tracking-wide">
                Lector de huella no encontrado...
              </p>
            </div>

            {/* DERECHA: TÍTULO, CAMPO PIN Y TECLADO */}
            <div className="flex-1 h-full bg-[#2e303f] rounded-r-[4px] p-6 flex flex-col items-center justify-center gap-4 md:border-l border-white/5">
              <div className="w-[321px]">
                <h3 className="text-xs font-medium text-white uppercase tracking-[0.15em] text-center mb-3">
                  Ingrese Su PIN
                </h3>

                {/* PIN DISPLAY */}
                <div className="relative w-full">
                  <div className="w-full h-11 bg-[#212330] border border-white/10 rounded-[4px] flex items-center justify-center relative overflow-hidden">
                    <div className="flex items-center gap-3 overflow-x-auto max-w-full px-4 scrollbar-none">
                      {[...Array(pin.length)].map((_, i) => (
                        <div
                          key={i}
                          className="w-3.5 h-3.5 rounded-full bg-white flex-shrink-0 transition-all duration-150"
                        />
                      ))}
                      <span className="fast-blink text-white/60 font-light ml-1 text-xl flex-shrink-0">|</span>
                    </div>
                  </div>
                  {error && (
                    <div className="absolute left-0 right-0 -bottom-5 text-center text-[9px] font-medium text-red-400 uppercase tracking-wider animate-shake">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* KEYPAD GRID */}
              <div className="w-[321px] h-[313px] mx-auto border-t border-l border-white/10 grid grid-cols-4 grid-rows-4 bg-[#23242f] rounded-[4px] overflow-hidden">
                {/* Row 1 */}
                <button
                  onClick={() => handlePinInput('7')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  7
                </button>
                <button
                  onClick={() => handlePinInput('8')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  8
                </button>
                <button
                  onClick={() => handlePinInput('9')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  9
                </button>
                {/* Backspace spans 2 rows */}
                <button
                  onClick={() => setPin(prev => prev.slice(0, -1))}
                  className="row-span-2 h-full flex items-center justify-center border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414A2 2 0 0010.828 19H20a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>

                {/* Row 2 */}
                <button
                  onClick={() => handlePinInput('4')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  4
                </button>
                <button
                  onClick={() => handlePinInput('5')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  5
                </button>
                <button
                  onClick={() => handlePinInput('6')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  6
                </button>

                {/* Row 3 */}
                <button
                  onClick={() => handlePinInput('1')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  1
                </button>
                <button
                  onClick={() => handlePinInput('2')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  2
                </button>
                <button
                  onClick={() => handlePinInput('3')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  3
                </button>
                {/* Checkmark spans 2 rows */}
                <button
                  onClick={() => {
                    if (pin.length > 0) handleLogin(undefined, pin);
                    else {
                      setError('INGRESE SU PIN');
                      setTimeout(() => setError(''), 2000);
                    }
                  }}
                  className="row-span-2 h-full flex items-center justify-center border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Row 4 */}
                <button
                  onClick={() => handlePinInput('0')}
                  className="col-span-2 h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  0
                </button>
                <button
                  onClick={() => handlePinInput('.')}
                  className="h-full flex items-center justify-center font-medium text-white border-r border-b border-white/10 hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  .
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CIERRE DEL DÍA (IMPLEMENTACIÓN BASADA EN REFERENCIA) */}
      {showCloseDayModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl bg-[#2e303f] rounded-[4px] border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row">
            {/* IZQUIERDA: GRILLA DE CAJAS */}
            <div className="flex-[1.5] p-8 border-r border-white/10">
              <div className="bg-[#383b4d] p-2.5 rounded-[4px] text-center mb-6 border border-white/5">
                <span className="text-white font-medium text-sm tracking-wider">Cajas</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* BOTÓN TODAS LAS CAJAS */}
                <button
                  onClick={() => setSelectedRegisterForClose('ALL')}
                  className={`h-14 border rounded-[4px] flex items-center justify-center p-4 transition-all ${selectedRegisterForClose === 'ALL'
                    ? 'bg-white/10 border-white/20'
                    : 'bg-[#383b4d] border-white/5 hover:bg-white/5'
                    }`}
                >
                  <span className="font-medium text-xs text-white tracking-wide text-center">Todas las Cajas</span>
                </button>

                {/* BOTONES POR CADA CAJA REGISTRADA */}
                {registerList.map(reg => (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedRegisterForClose(reg.id)}
                    className={`h-14 border rounded-[4px] flex items-center justify-center p-4 transition-all text-center ${selectedRegisterForClose === reg.id
                      ? 'bg-white/10 border-white/20'
                      : 'bg-[#383b4d] border-white/5 hover:bg-white/5'
                      }`}
                  >
                    <span className="font-medium text-xs text-white tracking-wide leading-tight">{reg.name}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-[10px] font-normal text-white/50 tracking-normal italic">
                *En el reporte aparecerán únicamente los Turnos ya cerrados.
              </p>
            </div>

            {/* DERECHA: ACCIONES Y FECHA */}
            <div className="flex-1 p-8 flex flex-col justify-center items-center gap-6">
              {/* SELECTOR DE FECHA */}
              <div className="w-full text-center">
                <label className="block text-[10px] font-medium text-[#ebd69b] uppercase tracking-[0.2em] mb-2">FECHA</label>
                <div className="relative mx-auto max-w-[200px]">
                  <input
                    type="date"
                    value={selectedCloseDate}
                    onChange={(e) => setSelectedCloseDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {
                        console.error('showPicker error:', err);
                      }
                    }}
                    className="w-full h-10 bg-[#212330] border border-white/10 rounded-[4px] px-4 text-white font-medium text-xs tracking-wider outline-none focus:border-white/20 transition-all text-center custom-calendar-picker cursor-pointer"
                  />
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="w-full space-y-4 max-w-[200px]">
                <button
                  onClick={handlePrintReport}
                  className="relative w-full h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-medium text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all shadow-md active:scale-95 overflow-hidden"
                >
                  IMPRIMIR
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-yellow-500 border-l-[10px] border-l-transparent pointer-events-none" />
                </button>

                <button
                  onClick={handleSendEmailReport}
                  className="relative w-full h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-medium text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all shadow-md active:scale-95 overflow-hidden"
                >
                  ENVIAR CORREO
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-blue-500 border-l-[10px] border-l-transparent pointer-events-none" />
                </button>

                <button
                  onClick={() => {
                    setShowCloseDayModal(false);
                    setSelectedRegisterForClose('ALL');
                  }}
                  className="relative w-full h-11 bg-[#383b4d] border border-white/5 rounded-[4px] flex items-center justify-center text-white font-medium text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-all shadow-md active:scale-95 overflow-hidden"
                >
                  CERRAR
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-red-500 border-l-[10px] border-l-transparent pointer-events-none" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {boxLockedError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 animate-fade-in">
          <div className="w-full max-w-[450px] bg-[#2e303f] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-[#212330] py-3.5 px-4 flex justify-center border-b border-white/5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.25em]">
                Restaurante Las Palmas POS
              </span>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center gap-6">
              <p className="text-white text-[13px] font-semibold text-center leading-relaxed px-2">
                {boxLockedError}
              </p>

              <button
                onClick={() => setBoxLockedError(null)}
                className="w-[150px] h-[38px] bg-[#5c6bc0] hover:bg-[#4c5bb0] text-white font-medium text-[11px] uppercase tracking-[0.2em] rounded-[6px] transition-all active:scale-[0.97] shadow-lg flex items-center justify-center"
              >
                ACEPTAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
