
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Login } from './components/Login';
import { User, Table, Order } from './types';
import { useGlobalKeyboardNavigation } from './hooks/useGlobalKeyboardNavigation';

import { supabase } from './supabase';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { PinModalV2 as PinModal } from './components/PinModalV2';
import { useSecurityPolicy } from './hooks/useSecurityPolicy';

import { RemotePrintListener } from './components/PrintListener';

import { useOfflineSync } from './hooks/useOfflineSync';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useDataSync } from './hooks/useDataSync';
import { initAudio } from './utils/sound';
import { NotificationContainer } from './components/NotificationContainer';
import { getSecureSoundUrl } from './utils/supabaseUtils';

// Static Imports for Critical Path Stability
import { DashboardMain as Dashboard } from './components/DashboardMain';
import { TableGrid } from './components/TableGrid';
import { OrderView } from './components/OrderView';
import { KitchenView } from './components/KitchenView';
import { DispatchView } from './components/DispatchView';
import { AdminPortal } from './components/admin/AdminPortal';
import { OpenShiftView } from './components/OpenShiftView';
import { CheckoutView } from './components/CheckoutView';
import { OrderViewer } from './components/OrderViewer';
import { KdsStationSelector } from './components/KdsStationSelector';
import { DriverTracker } from './components/driver/DriverTracker';
import { BillingViewer } from './components/BillingViewer';
import { Installer } from './components/admin/Installer';
import ModuloProduccion from './components/produccion/ModuloProduccion';

type ViewState = 'LOGIN' | 'DASHBOARD' | 'TABLES' | 'ORDER' | 'CHECKOUT' | 'HISTORY' | 'DELIVERY' | 'TAKEOUT' | 'KITCHEN' | 'ADMIN_PORTAL' | 'OPEN_SHIFT' | 'DRIVER_TRACKER' | 'BILLING_VIEWER' | 'KDS_STATION_SELECT' | 'PRODUCCION';

import { useNotify } from './hooks/useNotify';

const APP_VERSION = '1.6.4'; // v1.6.4 - Senior Engineering & Global Backup


console.log('%c🚀 LAS PALMAS POS SYSTEM - VERSION ' + APP_VERSION + ' LOADED', 'background: #4f46e5; color: white; padding: 10px; font-weight: bold; border-radius: 5px;');

const App: React.FC = () => {
  const notify = useNotify();

  // Activa la navegación global por teclado (Enter = Tab, Esc = blur/close)
  useGlobalKeyboardNavigation();

  useEffect(() => {
    // Intercept native alerts to comply with custom Notification System policy
    window.alert = (message?: any) => {
      const msg = String(message || '');
      // Auto-categorize based on context markers often found in standard strings
      if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fallo') || msg.includes('🚫') || msg.includes('⛔') || msg.includes('❌')) {
        notify.error(msg);
      } else if (msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('exito') || msg.includes('✅') || msg.toLowerCase().includes('guardad') || msg.toLowerCase().includes('correctamente') || msg.toLowerCase().includes('actualizad') || msg.toLowerCase().includes('completad')) {
        notify.success(msg);
      } else if (msg.toLowerCase().includes('conectad') || navigator.onLine === false || msg.includes('🔌')) {
        notify.offline(msg);
      } else {
        notify.info(msg);
      }
    };
  }, [notify]);

  const [loadingSession, setLoadingSession] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [operatorDashboardLead, setOperatorDashboardLead] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('LOGIN');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [waiterVoiceEnabled, setWaiterVoiceEnabled] = useState(true);
  const [pendingTableSelection, setPendingTableSelection] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [showLimitPin, setShowLimitPin] = useState(false);
  const [showLogoutPin, setShowLogoutPin] = useState(false);
  const [adminTab, setAdminTab] = useState<string | null>(null);
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [paymentBlocked, setPaymentBlocked] = useState<boolean>(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(true); // v1.5.5 - Added for robust status indicator

  const [serverOffset, setServerOffset] = useState<number>(() => {
    const cached = localStorage.getItem('kds_server_offset');
    return cached ? parseInt(cached, 10) : 0;
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowServer = new Date(Date.now() + serverOffset);
  const timeDisplay = nowServer.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateDisplay = nowServer.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');


  // Live Clock Component
  const LiveClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };

    return (
      <div className="fixed bottom-0 right-0 z-[9999] px-4 py-1 text-white font-black pointer-events-none flex flex-col items-end mix-blend-difference drop-shadow-sm select-none">
        <span style={{ fontSize: '13px', lineHeight: '1.2', letterSpacing: '0.05em' }}>{formatTime(time)}</span>
        <span style={{ fontSize: '11px', opacity: 0.8, lineHeight: '1' }}>{formatDate(time)}</span>
      </div>
    );
  };

  // Initialize Offline Sync
  useOfflineSync();

  // Initialize Master Data Sync
  const { syncData, syncType, isSyncing, syncMasterData } = useDataSync();

  const { isOnline, isServerConnected } = useNetworkStatus();

  // Connection Banner Component
  const ConnectionBanner = () => {
    if (isOnline && isServerConnected) return null;

    const isGhostOffline = isOnline && !isServerConnected;
    
    return (
      <div className={`${isGhostOffline ? 'bg-indigo-600' : 'bg-red-600'} text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse z-[100] shadow-lg sticky top-0 left-0 right-0 transition-colors duration-500`}>
        <AlertTriangle size={20} />
        <span className="font-bold text-sm uppercase tracking-widest flex items-center gap-2 text-center">
          {isGhostOffline ? (
            <>⚠️ SESIÓN EXPIRADA: RE-INGRESA TU PIN PARA REESTABLECER CONEXIÓN</>
          ) : (
            <>⚠️ MODO OFFLINE: Sin conexión a internet. Las órdenes se guardarán localmente.</>
          )}
        </span>
      </div>
    );
  };

  // Listen for offline count updates
  useEffect(() => {
    const handleOfflineCount = (e: any) => {
      setOfflinePendingCount(e.detail || 0);
    };
    window.addEventListener('offline-sync-count', handleOfflineCount);
    return () => window.removeEventListener('offline-sync-count', handleOfflineCount);
  }, []);

  // AUDIO UNLOCK FOR PWA
  useEffect(() => {
    const unlockAudio = () => {
      initAudio();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // VERSION GUARD: Force Refresh on Update
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`🚀 New Version Detected: ${APP_VERSION} (was ${storedVersion}). Clearing Entire Cache...`);
      
      // Preserve device registration
      const actData = localStorage.getItem('activation_data');
      const devFinger = localStorage.getItem('device_fingerprint');

      localStorage.clear();
      sessionStorage.clear(); // Added session storage clear

      if (actData) localStorage.setItem('activation_data', actData);
      if (devFinger) localStorage.setItem('device_fingerprint', devFinger);
      localStorage.setItem('app_version', APP_VERSION);
      // Force reload from server (pass true to ignore cache)
      window.location.reload();
    }
  }, []);

  // AUTOMATIC TABLE UNLOCK
  useEffect(() => {
    let activityTimer: NodeJS.Timeout;
    const ACTIVITY_TIMEOUT = 30000; // 30 seconds

    const handleInactivity = async () => {
      if (selectedTable?.id) {
        console.warn('⚠️ Inactivity detected: Auto-Unlocking Table', selectedTable.number);
        try {
          // STRICT SENIOR FIX: Only update if it's a real database UUID (not temporary 't-...')
          if (selectedTable?.id && !selectedTable.id.toString().startsWith('t-')) {
            await supabase.from('tables')
              .update({ is_locked: false, locked_by: null })
              .eq('id', selectedTable.id);
          }
        } catch (e) {
          console.error('Auto-Unlock Error:', e);
        }
      }
    };

    const resetActivity = () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(handleInactivity, ACTIVITY_TIMEOUT);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetActivity));
    resetActivity();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetActivity));
      clearTimeout(activityTimer);
    };
  }, [selectedTable]);

  // REALTIME PRESENCE & LOCK SYNC (ROBUST CONNECTIVITY)
  useEffect(() => {
    if (!currentUser) return;

    let channel: any = null;
    let retryTimer: NodeJS.Timeout;
    let isMounted = true;
    let retryDelay = 3000;
    const MAX_RETRY_DELAY = 10000; // v1.5.6 - Reduced from 30s to 10s for faster POS recovery

    const connectGlobalSync = () => {
      try {
        if (!isMounted || !currentUser) return;
        console.log('📡 Establishing Global Realtime Sync (Locks)...');

        if (channel) supabase.removeChannel(channel);

        channel = supabase.channel('global_locks', {
          config: {
            broadcast: { self: true },
            presence: { key: currentUser.id },
          },
        })
          .subscribe(async (status) => {
            if (!isMounted) return;

            if (status === 'SUBSCRIBED') {
              console.log('✅ Global Sync Connected');
              setIsSupabaseConnected(true); 
              window.dispatchEvent(new CustomEvent('supabase-connection-status', { detail: true })); // v1.5.5 - Notify hook
              retryDelay = 3000; // Reset delay on success
              await channel.track({
                user_id: currentUser.id,
                online_at: new Date().toISOString(),
                role: currentUser.role
              });
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`⚠️ Global Sync Disconnected (${status}). Retrying in ${retryDelay / 1000}s...`);
              setIsSupabaseConnected(false); 
              window.dispatchEvent(new CustomEvent('supabase-connection-status', { detail: false })); // v1.5.5 - Notify hook
              clearTimeout(retryTimer);
              retryTimer = setTimeout(() => {
                retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
                connectGlobalSync();
              }, retryDelay);
            }
          });

      } catch (err) {
        console.error('❌ Global Sync Crash:', err);
        if (isMounted) {
          clearTimeout(retryTimer);
          // back off more gracefully
          retryTimer = setTimeout(connectGlobalSync, retryDelay * 2);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Window visible: Awakening Sync...');
        // v1.6.1 - Re-subscribe if disconnected, instead of non-existent reconnect()
        if (!channel || channel.state !== 'joined') {
          connectGlobalSync();
        }
      }
    };

    const handleOnline = async () => {
      console.log('🌐 Network online: Forcing immediate recovery...');
      clearTimeout(retryTimer);
      retryDelay = 3000;
      
      // v1.5.9 - Proactive Session Recovery
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
           console.log('🔄 Offline -> Online: Attempting session refresh...');
           await supabase.auth.refreshSession();
        }
      } catch (e) { console.error('Session verify failed on line reset:', e); }

      connectGlobalSync(); // v1.6.1 - Removed faulty reconnect()
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    connectGlobalSync();

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Load User from Cache & Initialize
  useEffect(() => {
    const initSession = async () => {
      try {
        // 0. Hardware ID / Device Registration Check
        const cachedActivation = localStorage.getItem('activation_data');
        const deviceId = localStorage.getItem('device_fingerprint');

        if (cachedActivation) {
          const act = JSON.parse(cachedActivation);
          if (act?.org_id) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('subscription_status')
              .eq('id', act.org_id)
              .single();

            if (orgData && orgData.subscription_status !== 'active') {
              setPaymentBlocked(true);
              setLoadingSession(false);
              return;
            }
          }
          setIsActivated(true);
        } else if (deviceId) {
          // Verify against DB (for persistence after cache clear)
          const { data: registration } = await supabase
            .from('device_registrations')
            .select('*, branches(id, name, org_id, organizations(name))')
            .eq('fingerprint', deviceId)
            .eq('status', 'authorized')
            .single();

          if (registration) {
            const activationData = {
              branch_id: registration.branch_id,
              branch_name: registration.branches?.name,
              org_id: registration.branches?.org_id,
              org_name: registration.branches?.organizations?.name,
              activated_at: registration.created_at
            };
            localStorage.setItem('activation_data', JSON.stringify(activationData));

            // Check subscription status
            if (registration.branches?.organizations?.subscription_status !== 'active') {
              setPaymentBlocked(true);
              setLoadingSession(false);
              return;
            }

            setIsActivated(true);
          } else {
            setIsActivated(false);
            setLoadingSession(false);
            return;
          }
        } else {
          setIsActivated(false);
          setLoadingSession(false);
          return; // Force Installer
        }

        // 1. Check Supabase Auth Session Strength
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        let activeSession = session;
        if ((!activeSession || sessionError) && navigator.onLine) {
          console.warn('🔄 App: No session found but online. Attempting Refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session) {
            activeSession = refreshData.session;
            console.log('✅ App: Session restored successfully.');
          } else {
            console.error('❌ App: Session recovery failed:', refreshError);
          }
        }

        const cachedUserStr = localStorage.getItem('currentUser');
        if (cachedUserStr) {
          const user = JSON.parse(cachedUserStr);
          
          // v1.5.7 - Forced Login if online but session is dead
          if (!activeSession && navigator.onLine) {
            console.error('⛔ App: Online but Session expired. Forcing PIN re-entry to restore connectivity.');
            notify.error('Sesión caducada por inactividad. Ingresa tu PIN de nuevo para sincronizar.');
            setCurrentUser(null); // This triggers the redirect to LOGIN
            setLoadingSession(false);
            return;
          }

          setCurrentUser(user);

          // AUTO-RECOVERY on reload
          const cachedProds = localStorage.getItem('cached_products');
          if (!cachedProds || cachedProds.length < 10) {
            console.log('🔄 Cache vacío detectado post-reload. Forzando sincronización maestra...');
            syncData();
          }

          // Restore Lead User if it was an operator dashboard session
          const cachedLead = localStorage.getItem('operatorDashboardLead');
          if (cachedLead) setOperatorDashboardLead(JSON.parse(cachedLead));

          // Restore View Logic
          if (user.role?.toUpperCase() === 'COCINA') {
            const savedStation = localStorage.getItem('current_kds_station');
            if (savedStation) setCurrentView('KITCHEN');
            else setCurrentView('KDS_STATION_SELECT');
          } else if (user.role?.toUpperCase() === 'ADMIN') {
            // Admin goes directly to portal, skipping tiles dashboard
            setCurrentView('ADMIN_PORTAL');
          } else {
            // Force Dashboard to ensure clean state on reload
            setCurrentView('DASHBOARD');
          }
        }
      } catch (e) {
        console.error("Error restoring session:", e);
        // Fallback: Clear potentially corrupted cache
        localStorage.removeItem('currentUser');
      } finally {
        setLoadingSession(false);
      }
    };

    initSession();
  }, []);

  const handleLogin = async (user: User) => {
    if (!user) {
      console.error('Login attempted with null user');
      return;
    }
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));

    // AUTO-RECOVERY: If cache is empty, force sync immediately
    const cachedProds = localStorage.getItem('cached_products');
    if (!cachedProds || cachedProds.length < 10) {
      console.log('🔄 Cache vacío detectado post-login. Forzando sincronización maestra...');
      syncData();
    }

    if ((window as any).electronAPI && (window as any).electronAPI.sendLoginSuccess) {
      (window as any).electronAPI.sendLoginSuccess();
    }

    if (user.role?.toUpperCase() === 'COCINA') {
      const savedStation = localStorage.getItem('current_kds_station');
      if (savedStation) setCurrentView('KITCHEN');
      else setCurrentView('KDS_STATION_SELECT');
    } else if (user.role?.toUpperCase() === 'PRODUCCION') {
      setCurrentView('PRODUCCION');
    } else if (user.role?.toUpperCase() === 'ADMIN') {
      setCurrentView('ADMIN_PORTAL');
    } else {
      // CASE-INSENSITIVE permission check: permissions are stored lowercase
      const normalizedPerms = (user.permissions || []).map(p => p.toLowerCase());
      const hasCashAccess = user.role?.toUpperCase() === 'CAJERO' ||
        normalizedPerms.some(p => p.includes('cajas:acceso') || p.includes('cajero'));
      if (hasCashAccess) {
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('id')
          .eq('cashier_id', user.id)
          .is('end_time', null)
          .order('start_time', { ascending: false })
          .limit(1);

        if (shiftData && shiftData.length > 0) setCurrentView('DASHBOARD');
        else setCurrentView('OPEN_SHIFT');
      } else {
        setCurrentView('DASHBOARD');
      }
    }
  };

  const handleLogout = async (isSoftLogout: boolean = false) => {
    // SECURITY: FORCE FULL LOGOUT ON EVERY EXIT
    await supabase.auth.signOut();
    
    // Preserve device registration
    const actData = localStorage.getItem('activation_data');
    const devFinger = localStorage.getItem('device_fingerprint');

    localStorage.clear();
    sessionStorage.clear();

    if (actData) localStorage.setItem('activation_data', actData);
    if (devFinger) localStorage.setItem('device_fingerprint', devFinger);

    if ((window as any).electronAPI && (window as any).electronAPI.sendLogout) {
      (window as any).electronAPI.sendLogout();
    }

    // Reset all React states
    setCurrentUser(null);
    setOperatorDashboardLead(null);
    setCurrentView('LOGIN'); // Main Login Form
    setSelectedTable(null);
    setActiveOrder(null);
    setWaiterVoiceEnabled(false);
    setAdminTab(null);
    setPendingTableSelection(null);
    setShowLimitPin(false);
  };

  const [settings, setSettings] = useState<any>({});

  const fetchSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*').single();
    if (data) {
      setSettings(data);
      localStorage.setItem('system_settings', JSON.stringify(data));
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleNavigate = (view: string) => {
    // SECURITY: Admin Route Protection
    if (view.startsWith('ADMIN_')) {
      if (!currentUser || currentUser.role !== 'ADMIN') {
        console.warn('⛔ Unauthorized Admin Access attempt');
        return;
      }

      setAdminTab(null);
      setCurrentView('ADMIN_PORTAL');
    } else {
      setCurrentView(view as ViewState);
    }
  };

  const handleActivationSuccess = (data: any) => {
    console.log('✅ Activation Successful:', data);
    setIsActivated(true);
    setCurrentView('LOGIN');
  };

  const validatePin = async (pin: string, requiredRole: string = 'ADMIN') => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('pin', pin)
      .eq('role', requiredRole)
      .maybeSingle();

    if (profile && !error) {
      let permissions: string[] = [];
      if (profile.role_id) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('permissions')
          .eq('id', profile.role_id)
          .maybeSingle();

        if (roleData) {
          const rawPerms = roleData.permissions;
          if (Array.isArray(rawPerms)) {
            permissions = rawPerms.map(p => p.toLowerCase().trim());
          } else if (typeof rawPerms === 'object' && rawPerms !== null) {
            permissions = ((rawPerms as any).actions || []).map((p: string) => p.toLowerCase().trim());
          }
        }
      }

      return {
        id: profile.id,
        name: profile.name || profile.full_name || 'Admin',
        role: profile.role,
        role_id: profile.role_id,
        permissions: permissions
      } as User;
    }
    return null;
  };

  // Persist Waiter Voice Setting - Default to TRUE if not set
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`waiterVoice_${currentUser.id}`);
      // Default to true if null (not set), otherwise parse boolean
      setWaiterVoiceEnabled(saved === null ? true : saved === 'true');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`waiterVoice_${currentUser.id}`, waiterVoiceEnabled.toString());
    }
  }, [waiterVoiceEnabled, currentUser]);

  // Use Ref to hold the sound URL so variable scope issues don't blocking it
  const waiterSoundUrlRef = React.useRef<string | null>(null);
  const kdsSoundUrlRef = React.useRef<string | null>(null);
  const [globalSoundSet, setGlobalSoundSet] = useState<{ enabled: boolean, volume: number }>({ enabled: true, volume: 0.8 });

  // Global Waiter Notifications
  useEffect(() => {
    if (!currentUser) return; // Removed strict waiterVoiceEnabled check for subscription to ensure we can log even if silent

    // Fetch the admin-configured waiter sound
    const loadWaiterSound = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('waiter_sound_id')
          .eq('id', 1)
          .single();

        const soundId = (data as any)?.waiter_sound_id;
        if (soundId) {
          const { data: soundData } = await supabase
            .from('sound_library')
            .select('file_url')
            .eq('id', soundId)
            .single();

          if (soundData?.file_url) {
            const secureUrl = getSecureSoundUrl(soundData.file_url);
            waiterSoundUrlRef.current = secureUrl;
            console.log('🔔 [App] Waiter sound loaded into Ref:', secureUrl);
          }
        }
      } catch (e) {
        console.warn('[App] Could not load waiter sound, will use default ding', e);
      }
    };

    loadWaiterSound();

    console.log('🔌 [App] Suscribiendo a notificaciones globales para:', currentUser.name, 'Alertas Activas:', waiterVoiceEnabled);
    const globalChannel = supabase
      .channel(`order_notifs_global_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items'
        },
        async (payload: any) => {
          // Check if status changed to ready
          if (payload.new.status === 'ready' && payload.old.status !== 'ready') {
            console.log('🔔 [App] Evento "Ready" recibido. Procesando...');
            try {
              const { data: orderData } = await supabase
                .from('orders')
                .select('waiter_id, order_number, table_id')
                .eq('id', payload.new.order_id)
                .single();

              if (!orderData) return;

              // Admins hear all, waiters only theirs
              const isMyOrder = orderData.waiter_id === currentUser.id || currentUser.role === 'ADMIN';
              console.log(`🔔 [App] Notificación "Ready" - Admin u Orden Propia? ${isMyOrder} (User Alerts: ${waiterVoiceEnabled})`);

              if (isMyOrder) {
                // If it's an admin, we might want them to hear it even if their personal bell is off, 
                // but let's stick to the bell for now to respect user preference, 
                // UNLESS it's a KDS order. 

                if (!waiterVoiceEnabled) {
                  console.log('🔕 [App] Notificación silenciada por el icono de campana del usuario.');
                  return;
                }

                const soundUrl = waiterSoundUrlRef.current;
                if (soundUrl) {
                  const audio = new Audio(soundUrl);
                  audio.volume = 1.0;
                  audio.play().catch(async (err) => {
                    console.error('🔔 [App] Waiter sound failed:', err);
                    const { playNotificationSound } = await import('./utils/sound');
                    playNotificationSound();
                  });
                } else {
                  const { playNotificationSound } = await import('./utils/sound');
                  playNotificationSound();
                }
              }
            } catch (err) {
              console.error("Error en notificación global [App]:", err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [waiterVoiceEnabled, currentUser]);

  // Global KDS Notifications (New Orders) - For Admins and Kitchen
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'COCINA')) return;

    const loadKdsSound = async () => {
      try {
        const { data: st } = await supabase.from('system_settings').select('kds_default_sound_id, kds_alert_enabled, kds_alert_volume').eq('id', 1).maybeSingle();
        if (st) {
          setGlobalSoundSet({ enabled: st.kds_alert_enabled, volume: st.kds_alert_volume });
          if (st.kds_default_sound_id) {
            const { data: sd } = await supabase.from('sound_library').select('file_url').eq('id', st.kds_default_sound_id).single();
            if (sd?.file_url) {
              kdsSoundUrlRef.current = getSecureSoundUrl(sd.file_url);
              console.log('🔊 [App] KDS Global sound loaded:', kdsSoundUrlRef.current);
            }
          }
        }
      } catch (e) { console.warn('[App] KDS sound load error', e); }
    };
    loadKdsSound();

    const kdsChannel = supabase.channel('kds_global_new_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        // Prevent double sound if user is already in KitchenView
        if (currentView === 'KITCHEN') return;

        console.log('🔊 [App] Global KDS Order detected (INSERT)');
        if (globalSoundSet.enabled) {
          const url = kdsSoundUrlRef.current;
          if (url) {
            const audio = new Audio(url);
            audio.volume = globalSoundSet.volume || 0.8;
            console.log('🔊 [App] Playing Global KDS Alert...');
            audio.play().catch(e => console.warn('KDS Global sound blocked:', e));
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, () => {
        loadKdsSound();
      })
      .subscribe();

    return () => { supabase.removeChannel(kdsChannel); };
  }, [currentUser, currentView]); // Removed globalSoundSet dependencies to avoid loops

  const handleSelectTable = async (table: Table, pax: number = 1) => {
    setSelectedTable(table);

    // ALWAYS check for active orders, regardless of table.status
    // This handles cases where state might be out of sync
    const { data: existingOrders, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('table_id', table.id)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }); // Get earliest first for primary context

    if (existingOrders && existingOrders.length > 0 && !error) {
      const existingOrder = existingOrders[existingOrders.length - 1]; // Use latest as main for addition, or we can improve this later

      // --- RESTRICTION: Lock Tables to Waiter ---
      const userRole = currentUser?.role || '';
      const isStaff = userRole === 'ADMIN' || userRole === 'CAJERO' || userRole === 'SUPERVISOR';

      // If multiple orders, we might need a selection, but for now let's take the first one they created or the latest.
      // If user is MESERO, check if any of these orders belong to them.
      let myOrder = existingOrders.find(o => o.waiter_id === currentUser?.id);
      let targetOrder = myOrder || existingOrders[0];

      if (userRole === 'MESERO' && targetOrder.waiter_id && targetOrder.waiter_id !== currentUser?.id) {
        alert(`🚫 ACCESO DENEGADO\n\nEsta mesa tiene una orden activa de otro mesero.`);
        return;
      }

      const formattedOrder = {
        ...targetOrder,
        items: (targetOrder.order_items || []).map((item: any) => ({
          ...item,
          product_name: item.products?.name || 'Producto',
          product: item.products,
          price: item.unit_price,
          unit_price: item.unit_price,
          is_sent: true
        }))
      };

      setActiveOrder(formattedOrder);
      setCurrentView('ORDER');
      return;
    }

    // Default: New Order Flow
    // Check waiter limit BEFORE creating new order
    const limit = Number(settings?.max_active_orders_per_waiter || 0);
    const userRole = currentUser?.role || '';

    // Only verify for non-admins/non-cashiers if limit > 0
    if (limit > 0 && userRole !== 'ADMIN' && userRole !== 'SUPERVISOR' && userRole !== 'CAJERO') {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('waiter_id', currentUser?.id)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      // Log to console instead of blocking alert
      console.log('🔒 Waiter Limit Check:', { limit, count, error: error?.message });

      if ((count || 0) >= limit) {
        console.log('🚫 Limit reached! Showing PIN modal...');
        setPendingTableSelection({ table, pax });
        setShowLimitPin(true);
        return;
      }

      console.log('✅ Limit not reached, proceeding with order creation');
    }

    // 3. Construct Virtual New Order (Lazy Creation)
    // We don't insert into DB yet to avoid wasting order numbers if abandoned.
    // BUT we do "Soft Lock" the table so others know it's being attended.
    const virtualOrder = {
      id: null, // Indicates it's not in DB yet
      table_id: table.id,
      status: 'pending',
      order_type: 'DINE_IN',
      pax_count: pax,
      waiter_id: currentUser?.id || '',
      subtotal: 0,
      tax_amount: 0,
      total: 0,
      branch_id: currentUser?.branch_id,
      items: [],
      tax: 0,
      discount: 0
    };

    setActiveOrder(virtualOrder);
    setCurrentView('ORDER');
  };

  const handleCreateDispatchOrder = async (customerData: any) => {
    try {
      // 1. Gestionar Cliente (Buscar por teléfono o crear)
      let customerId = customerData.customer_id;

      if (!customerId && customerData.phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', customerData.phone)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Actualizar datos del cliente existente
          await supabase.from('customers').update({
            name: customerData.name,
            email: customerData.email,
            address: customerData.address,
            reference: customerData.reference,
            notes: customerData.notes,
            nit: customerData.nit,
            city: customerData.city,
            phone2: customerData.phone2
          }).eq('id', customerId);
        } else {
          // Crear nuevo cliente
          const { data: newCustomer, error: createError } = await supabase.from('customers').insert({
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email,
            address: customerData.address,
            reference: customerData.reference,
            notes: customerData.notes,
            nit: customerData.nit,
            city: customerData.city,
            phone2: customerData.phone2,
            current_balance: 0,
            credit_limit: 0
          }).select().single();

          if (createError) throw createError;
          customerId = newCustomer.id;
        }
      }

      // 2. Construir dirección completa para la orden
      const fullDeliveryAddress = [
        customerData.address,
        customerData.reference ? `Ref: ${customerData.reference}` : '',
        customerData.city ? `Ciudad: ${customerData.city}` : '',
        customerData.notes ? `Nota: ${customerData.notes}` : ''
      ].filter(Boolean).join(' | ');

      if (customerId || customerData.phone) {
        setSelectedTable(null);
        // Construct virtual order for dispatch
        const virtualOrder = {
          id: null,
          order_type: customerData.type,
          customer_name: customerData.name,
          customer_phone: customerData.phone,
          delivery_address: fullDeliveryAddress,
          customer_id: customerId,
          platform_id: customerData.platform_id,
          is_platform_driver: customerData.is_platform_driver,
          status: 'pending',
          waiter_id: currentUser?.id,
          subtotal: 0,
          tax_amount: 0,
          total: 0,
          pax_count: 1,
          branch_id: currentUser?.branch_id,
          items: [],
          tax: 0,
          discount: 0
        };
        setActiveOrder(virtualOrder);
        setCurrentView('ORDER');
      } else {
        alert('Error: Datos de cliente insuficientes');
      }
    } catch (err: any) {
      console.error('Unexpected error setting up dispatch order:', err);
      alert('Error inesperado: ' + err.message);
    }
  }


  const handleReopenOrder = async (orderId: string) => {
    // Fetch order without embedded order_items (due to FK ambiguity)
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (order && !error) {
      // Fetch order_items separately
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', orderId);

      // Fetch table info
      const { data: table } = await supabase.from('tables').select('*').eq('id', order.table_id).single();

      const formattedOrder: Order = {
        ...order,
        order_items: orderItems || [],
        items: (orderItems || []).map((item: any) => ({
          ...item,
          product_name: item.products?.name || 'Producto',
          product: item.products,
          price: item.unit_price,
          unit_price: item.unit_price
        }))
      };

      setSelectedTable(table);
      setActiveOrder(formattedOrder);
      setCurrentView('ORDER');
    }
  };

  const navigateBack = async () => {
    // SECURITY: If we were in an UNSAVED table order, unlock the table before leaving
    // SECURITY: Always clear the lock when leaving the order view
    // REFINEMENT: If no order was ever saved (activeOrder.id is null), ensure table returns to 'available'
    if (selectedTable?.id) {
        const isNewOrder = !activeOrder?.id;
        await supabase.from('tables').update({
          locked_by: null,
          ...(isNewOrder ? { status: 'available' } : {})
        }).eq('id', selectedTable.id);
    }

    if (currentView === 'OPEN_SHIFT') {
      handleLogout();
    } else if (currentView === 'ORDER' || currentView === 'CHECKOUT') {
      if (currentUser?.role === 'MESERO' || currentUser?.role === 'CAJERO') {
        setCurrentView('DASHBOARD');
      } else {
        if (activeOrder?.order_type === 'DELIVERY') setCurrentView('DELIVERY_LIST');
        else if (activeOrder?.order_type === 'TAKEOUT') setCurrentView('TAKEOUT');
        else setCurrentView('TABLES');
      }
    } else if (['TABLES', 'HISTORY', 'DELIVERY', 'DELIVERY_LIST', 'TAKEOUT', 'KITCHEN', 'ADMIN_PORTAL', 'BILLING_VIEWER'].includes(currentView)) {
      setCurrentView('DASHBOARD');
    }
  };

  // Loading Fallback Component
  const LoadingScreen = () => (
    <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 gap-4">
      <Loader2 size={48} className="animate-spin text-indigo-500" />
      <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Cargando Módulo...</p>
    </div>
  );

  if (loadingSession) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-fade-in relative bg-[#2d2e3d] text-white gap-4">
        <Loader2 size={48} className="animate-spin text-indigo-500" />
        <p className="text-sm font-bold uppercase tracking-widest animate-pulse tracking-[0.3em]">Sincronizando Sistema...</p>
      </div>
    );
  }

  // FORCE ACTIVATION / INSTALLER
  if (!isActivated) {
    return (
      <div className="h-screen w-screen bg-[#2d2e3d]">
        <NotificationContainer />
        <Installer onActivationSuccess={handleActivationSuccess} />
      </div>
    );
  }

  // PAYMENT BLOCK
  if (paymentBlocked) {
    return (
      <div className="h-screen w-screen bg-[#1a1a1a] flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-white/5 border border-white/10 p-12 rounded-[50px] backdrop-blur-3xl shadow-2xl">
          <div className="w-28 h-28 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-10 border border-red-500/30">
            <AlertTriangle size={56} className="text-red-500 animate-pulse" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-6 leading-tight">Acceso<br />Restringido</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-12 px-2">
            Esta licencia de <span className="text-white font-bold">LAS PALMAS POS</span> ha sido suspendida temporalmente por <span className="text-white">vencimiento de pago o falta de suscripción</span>.
          </p>
          <div className="bg-red-500/10 p-8 rounded-3xl border border-red-500/20 mb-8 flex flex-col items-center">
            <span className="text-[10px] uppercase font-black text-red-400 tracking-[0.4em] mb-4">Contacto de Soporte</span>
            <p className="text-lg font-bold tracking-tight text-white mb-2">Administración Central</p>
            <p className="text-xs text-slate-400">Comuníquese para restaurar sus servicios.</p>
          </div>
          <div className="pt-6 border-t border-white/5">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Antigravity Multi-Tenant Engine v4.2</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[100dvh] overflow-hidden text-white flex flex-col transition-colors pos-main-layout bg-[#2d2e3d]`} style={{ WebkitOverflowScrolling: 'touch' }}>
      <ConnectionBanner />
      <NotificationContainer />
      <RemotePrintListener />
      {currentView === 'DRIVER_TRACKER' ? (
        <DriverTracker />
      ) : currentView === 'LOGIN' ? (
        <Login 
          onLogin={handleLogin} 
          onRefreshMenu={syncData}
          syncType={syncType}
          isSyncing={isSyncing}
        />
      ) : (
        <>
          {currentView !== 'OPEN_SHIFT' && (
            <div className={`relative h-12 border-b border-white/5 flex items-center justify-between px-4 z-20 shadow-xl transition-colors ${currentView === 'ADMIN_PORTAL' ? 'bg-[#106ebe]' : 'bg-[#3a3b4d]'} ${(currentView === 'DELIVERY' || currentView === 'DELIVERY_LIST' || currentView === 'KDS_STATION_SELECT') ? 'hidden' : ''}`}>
              <div className="flex items-center gap-6">
                {currentView !== 'DASHBOARD' && currentView !== 'ADMIN_PORTAL' && currentView !== 'CHECKOUT' && currentView !== 'DELIVERY' && currentView !== 'DELIVERY_LIST' && currentView !== 'KITCHEN' && (
                  <button onClick={navigateBack} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all pos-button">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
                <div className="flex flex-col">
                  <span className={`text-sm font-black tracking-tighter ${currentView === 'ADMIN_PORTAL' ? 'text-white' : 'text-indigo-400'}`}>{settings?.restaurant_name?.split(' ')[0] || 'LAS PALMAS'}</span>
                  <span className={`text-[10px] font-bold tracking-[0.3em] uppercase leading-none ${currentView === 'ADMIN_PORTAL' ? 'text-blue-200/60' : 'text-gray-500'}`}>{settings?.restaurant_name?.split(' ').slice(1).join(' ') || 'RESTAURANTE POS'}</span>
                </div>
              </div>

              {/* Centered CAJA BRANDING - Only for Cashiers */}
              {currentUser?.role?.toUpperCase() === 'CAJERO' && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 pointer-events-none">
                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <rect x="3" y="17" width="18" height="4" rx="1.5" />
                      <path d="M5 17V9h14v8" />
                      <rect x="11" y="3" width="8" height="4" rx="1" />
                      <path d="M14 7v2" />
                      <path d="M16 7v2" />
                      <path d="M7 14v-3l1-1 1 1 1-1 1 1v3" />
                      <path d="M6 14h6" />
                      <path fill="currentColor" stroke="none" d="M12.75 10.25h1.5v1.5h-1.5z M14.75 10.25h1.5v1.5h-1.5z M16.75 10.25h1.5v1.5h-1.5z M12.75 12.25h1.5v1.5h-1.5z M14.75 12.25h1.5v1.5h-1.5z M16.75 12.25h1.5v1.5h-1.5z M12.75 14.25h1.5v1.5h-1.5z M14.75 14.25h1.5v1.5h-1.5z M16.75 14.25h1.5v1.5h-1.5z" />
                    </svg>
                  </div>
                  <span className="text-lg font-black tracking-[0.5em] text-white uppercase opacity-90">Caja</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                {/* ROBUST NETWORK INDICATOR (v1.5.5) */}
                <div className="flex items-center gap-2">
                  <div
                    className={`relative w-4 h-4 rounded-full shadow-lg border-2 border-white/20 transition-all duration-500 ${isOnline ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-red-500 shadow-red-500/40 animate-pulse'}`}
                    title={isOnline ? (offlinePendingCount > 0 ? `En Línea - Sincronizando ${offlinePendingCount} registros` : "En Línea") : "Sin Conexión al Servidor"}
                  >
                    {isOnline && (
                      <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-10"></div>
                    )}
                    
                    {offlinePendingCount > 0 && (
                      <div className="absolute -top-2 -right-2 bg-indigo-600 text-[9px] font-black text-white w-4 h-4 rounded-full flex items-center justify-center border border-white/20 shadow-lg animate-bounce">
                        {offlinePendingCount}
                      </div>
                    )}
                  </div>

                  {offlinePendingCount > 0 && (
                    <button 
                      onClick={async (e) => {
                          e.stopPropagation();
                          
                          if (isOnline) {
                              notify.info('Intentando sincronizar registros locales...');
                              // Trigger manual sync event
                              window.dispatchEvent(new CustomEvent('manual-offline-sync'));
                              // Also try to refresh master data which might help auth
                              window.dispatchEvent(new CustomEvent('refresh-inventory'));
                              return;
                          }

                          if (window.confirm('⚠️ ATENCIÓN: El sistema no logra sincronizar. Se cerrará la sesión y se limpiarán los errores locales. Esto SOLUCIONARÁ los avisos de "Sin Conexión". ¿Desea continuar?')) {
                              try {
                                  const { offlineDB } = await import('./services/OfflineDB');
                                  await offlineDB.clearAll();
                                  await supabase.auth.signOut();
                                  
                                  // Preserve registration
                                  const actData = localStorage.getItem('activation_data');
                                  const devFinger = localStorage.getItem('device_fingerprint');
                                  localStorage.clear();
                                  if (actData) localStorage.setItem('activation_data', actData);
                                  if (devFinger) localStorage.setItem('device_fingerprint', devFinger);

                                  window.location.reload();
                              } catch (err) {
                                  console.error('Reset Error:', err);
                                  notify.error('No se pudo reiniciar la sesión.');
                              }
                          }
                      }}
                      className="p-1 px-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center gap-1 transition-all border border-red-500/20 group"
                      title={isOnline ? "Sincronizar Datos Pendientes" : "Reiniciar Sesión y Limpiar Errores"}
                    >
                        <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase">{isOnline ? 'Enviar Ahora' : 'Reiniciar App'}</span>
                    </button>
                  )}
                </div>

                {/* Clock & Date Bar Right */}
                <div className={`hidden lg:flex flex-col items-end leading-none px-3 py-1 rounded-xl border border-white/5 shadow-inner ${currentView === 'ADMIN_PORTAL' ? 'bg-white/10' : 'bg-black/30'}`}>
                  <span className={`text-[12px] font-black tracking-widest tabular-nums ${currentView === 'ADMIN_PORTAL' ? 'text-white' : 'text-indigo-400'}`}>{timeDisplay}</span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{dateDisplay}</span>
                </div>

                {currentView !== 'KITCHEN' && currentView !== 'KDS_STATION_SELECT' && (
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-bold text-white">{currentUser?.name || (currentUser as any)?.full_name}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest leading-none mt-0.5 ${currentView === 'ADMIN_PORTAL' ? 'text-white/70' : 'text-indigo-400'}`}>{currentUser?.role}</span>
                  </div>
                )}
                <div className="w-px h-8 bg-white/10 mx-1"></div>

                {/* Logout Button (moved to left of window controls) */}
                <button
                  onClick={() => {
                    // Soft logout for cashiers (back to cards), NO PIN anymore as per step 1632
                    if (currentUser?.role === 'CAJERO') {
                      handleLogout(true);
                    } else {
                      handleLogout(false); // Full logout for others
                    }
                  }}
                  className="p-2.5 text-red-100 hover:bg-white/10 rounded-xl transition-colors pos-button mr-2"
                  title="Cerrar Sesión"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m17 16 4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
                  </svg>
                </button>

                {/* Electron Window Controls - Absolute Right (Only Min/Max as requested) */}
                <div className="hidden md:flex items-center border-l border-white/10 h-10 -mr-6">
                  <button
                    title="Minimizar"
                    onClick={() => {
                      const win = window as any;
                      if (win.electron) win.electron.minimize();
                      else window.blur();
                    }}
                    className="w-12 h-12 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
                  >
                    <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="10" height="1" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    title="Maximizar / Restaurar"
                    onClick={() => {
                      const win = window as any;
                      if (win.electron) win.electron.maximize();
                      else {
                        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
                        else document.exitFullscreen().catch(() => { });
                      }
                    }}
                    className="w-12 h-12 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 overflow-hidden relative">
            {currentView === 'OPEN_SHIFT' && currentUser && <OpenShiftView currentUser={currentUser} onShiftOpened={() => setCurrentView('DASHBOARD')} onBack={handleLogout} />}
            {currentView === 'DASHBOARD' && <Dashboard 
              onNavigate={handleNavigate} 
              isAdmin={currentUser?.role?.toUpperCase() === 'ADMIN' || !!currentUser?.role_id} 
              settings={settings} 
              currentUser={currentUser} 
              onLogout={handleLogout}
              onRefreshMenu={syncData}
              syncType={syncType}
              isSyncing={isSyncing}
            />}
            {currentView === 'TABLES' && <TableGrid onSelectTable={handleSelectTable} />}
            {currentView === 'ORDER' && activeOrder && (
              <OrderView
                order={activeOrder}
                table={selectedTable}
                currentUser={currentUser}
                settings={settings}
                onClose={navigateBack}
                onCheckout={(ord) => { setActiveOrder(ord); setCurrentView('CHECKOUT'); }}
                waiterVoiceEnabled={waiterVoiceEnabled}
                onToggleWaiterVoice={() => setWaiterVoiceEnabled(!waiterVoiceEnabled)}
              />
            )}
            {currentView === 'CHECKOUT' && activeOrder && <CheckoutView order={activeOrder} table={selectedTable} currentUser={currentUser} settings={settings} onBack={() => setCurrentView('ORDER')} onComplete={() => { setSelectedTable(null); setActiveOrder(null); setCurrentView('TABLES'); }} />}
            {currentView === 'KITCHEN' && <KitchenView />}
            {currentView === 'KDS_STATION_SELECT' && <KdsStationSelector onSelect={() => setCurrentView('KITCHEN')} onLogout={() => { setCurrentUser(null); setCurrentView('LOGIN'); }} />}
            {currentView === 'DELIVERY' && <DispatchView type="DELIVERY" onCreateOrder={handleCreateDispatchOrder} onEditOrder={handleReopenOrder} onBack={navigateBack} initialMode="NEW" currentUser={currentUser} />}
            {currentView === 'DELIVERY_LIST' && <DispatchView type="DELIVERY" onCreateOrder={handleCreateDispatchOrder} onEditOrder={handleReopenOrder} onBack={navigateBack} initialMode="LIST" currentUser={currentUser} />}
            {currentView === 'TAKEOUT' && <DispatchView type="TAKEOUT" onCreateOrder={handleCreateDispatchOrder} onEditOrder={handleReopenOrder} onBack={navigateBack} initialMode="LIST" currentUser={currentUser} />}

            {currentView === 'HISTORY' && <OrderViewer onBack={() => setCurrentView('DASHBOARD')} onOpenOrder={handleReopenOrder} currentUser={currentUser} />}
            {currentView === 'BILLING_VIEWER' && (
              <BillingViewer
                onBack={() => setCurrentView('DASHBOARD')}
                currentUser={currentUser}
                onCheckout={(order) => {
                  setActiveOrder(order);
                  setCurrentView('CHECKOUT');
                }}
              />
            )}
            {currentView === 'ADMIN_PORTAL' && <AdminPortal currentUser={currentUser} initialTab={adminTab} onExit={handleLogout} />}
            {currentView === 'PRODUCCION' && (
              <ModuloProduccion 
                sucursalId={currentUser?.branch_id || ''} 
                onExit={() => {
                  setCurrentUser(null);
                  setCurrentView('LOGIN');
                  localStorage.removeItem('currentUser');
                }} 
              />
            )}
          </main>
        </>
      )}
      {currentView !== 'ADMIN_PORTAL' && <VirtualKeyboard />}

      {/* PIN Modal for Waiter Limit Override */}
      {showLimitPin && (
        <PinModal
          isOpen={showLimitPin}
          requiredRole="ADMIN"
          validateFn={(pin) => validatePin(pin, 'ADMIN')}
          onSuccess={(user) => {
            setShowLimitPin(false);
            if (pendingTableSelection) {
              const { table, pax } = pendingTableSelection;
              supabase.from('orders').insert({
                table_id: table.id,
                status: 'pending',
                order_type: 'DINE_IN',
                pax_count: pax,
                waiter_id: currentUser?.id || '',
                subtotal: 0,
                tax_amount: 0,
                total: 0,
                branch_id: currentUser?.branch_id
              }).select().single().then(({ data: newOrder, error: insertError }) => {
                if (!insertError && newOrder) {
                  supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id).then(() => {
                    setActiveOrder({
                      ...newOrder,
                      items: [],
                      tax: newOrder.tax_amount || 0,
                      discount: newOrder.discount_amount || 0
                    });
                    setCurrentView('ORDER');
                  });
                }
              });
              setPendingTableSelection(null);
            }
          }}
          onClose={() => {
            setShowLimitPin(false);
            setPendingTableSelection(null);
          }}
          title="Límite de Mesas Alcanzado"
          subtitle="Se requiere autorización de Administrador."
        />
      )}

      {/* PIN Modal for Logout/Soft Exit */}
      {showLogoutPin && (
        <PinModal
          isOpen={showLogoutPin}
          requiredRole="ANY"
          validateFn={async (pin) => {
            if (currentUser && currentUser.pin === pin) return currentUser;
            const res = await validatePin(pin, 'ADMIN');
            return res;
          }}
          onSuccess={() => {
            setShowLogoutPin(false);
            handleLogout(true); // Soft Logout -> Operator Dashboard
          }}
          onClose={() => setShowLogoutPin(false)}
          title="Autorizar Salida"
          subtitle="Ingresa tu PIN para regresar al Dashboard de Operadores."
        />
      )}
    </div>
  );
};

export default App;

