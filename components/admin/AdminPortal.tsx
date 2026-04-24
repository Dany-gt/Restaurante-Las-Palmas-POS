import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    Settings, Users, Shield, ChefHat, Wallet, Layout, CreditCard,
    MapPin, Printer, Percent, Globe, Bike, Receipt, Briefcase,
    Tag, Utensils, Eye, ListFilter, Layers, CheckSquare,
    Building,
    Truck, Package, ShoppingCart, BarChart3, ClipboardList,
    FileText, TrendingUp, PieChart, Search,
    X, LogOut, Bell, Clock, AlertTriangle,
    FileCheck, UserCheck, Trash, BookOpen,
    Maximize2, Minimize2, ChevronDown, Monitor, Cpu, Volume2,
    Baseline, ClipboardCheck, Type, Hash, Link,
    Puzzle, Boxes, ListChecks, FolderTree, Tags,
    FileCheck2, BadgePercent, FileX,
    Scissors, ArrowDownToLine, ArrowUpFromLine, CreditCard as CreditCardIcon,
    ListOrdered, FileWarning, FileMinus2,
    Sigma, CalendarDays, ArrowRightLeft, Scale, Wrench, Calculator
} from 'lucide-react';
// Existing Modules
import { UsuariosAdmin } from './UsuariosAdmin';
import { MenuAdmin } from './MenuAdmin';
import { MenuPreview } from './MenuPreview';
import { CategoriesAdmin } from './CategoriesAdmin';
import { ExpensesAdmin } from './ExpensesAdmin';
import { TablesAdmin } from './TablesAdmin';
import { SectionsTablesAdmin } from './SectionsTablesAdmin';
import { activityLogService } from '../../services/ActivityLogService';
import { SystemConfig } from './SystemConfig';
import { KitchensAdmin } from './KitchensAdmin';
import { CajasAdmin } from './CajasAdmin';
import { SuppliersAdmin } from './SuppliersAdmin';
import { ReportGeneral } from './ReportGeneral';
import { DishesModifiers } from './DishesModifiers';
import { DishesModifiersList } from './DishesModifiersList';
import { DishesModifiersAssign } from './DishesModifiersAssign';
import { DishesOptions } from './DishesOptions';
import { DishesOptionsList } from './DishesOptionsList';
import { DishesOptionsAssign } from './DishesOptionsAssign';
import { InventoryProducts } from './InventoryProducts';
import { InventoryStock } from './InventoryStock';
import { InventoryPurchases } from './InventoryPurchases';
import { AdminRoles } from './AdminRoles';
import { ReportOrders } from './ReportOrders';
import { ReportFacturas } from './ReportFacturas';
import { DashboardSales } from './DashboardSales';
import { DashboardDishes } from './DashboardDishes';
import { ConfigDiscounts } from './ConfigDiscounts';
import { ConfigDrivers } from './ConfigDrivers';
import { ConfigPlatforms } from './ConfigPlatforms';
import { DashboardExpenses } from './DashboardExpenses.tsx';
import { ConfigReceivable } from './ConfigReceivable';
import { InventoryTransfer } from './InventoryTransfer';
import { InventoryLeveling } from './InventoryLeveling';
import { InventoryKardex } from './InventoryKardex';
import { InventoryProduction } from './InventoryProduction';
import { ReportSoldItems } from './ReportSoldItems';
import { ReportCaja } from './ReportCaja';
import { ReportIngresosCaja } from './ReportIngresosCaja';
import { DashboardIngresosCaja } from './DashboardIngresosCaja';
import { ConfigPosCard } from './ConfigPosCard';
import { ReportBranch } from './ReportBranch';
import { ConfigWaiters } from './ConfigWaiters';
import { ConfigPrinters } from './ConfigPrinters';
import { ConfigSoundsCard } from './ConfigSoundsCard';
import { BranchesAdmin } from './BranchesAdmin';
import { OrganizationsAdmin } from './OrganizationsAdmin';
import { MenuEngineeringModal } from './MenuEngineeringModal';
import { MenuCosting } from './MenuCosting';
import { KitchenPerformanceReport } from './KitchenPerformanceReport';
import { RendimientoProduccion } from './RendimientoProduccion';
import { ReportPropinas } from './ReportPropinas';
import { ActivityHistoryDashboard } from './ActivityHistoryDashboard';
import { DashboardFacturacion } from './DashboardFacturacion';
import { DashboardVentasRendimiento } from './DashboardVentasRendimiento';
import { CostControl } from './CostControl';
import { AccountingPortal } from './accounting/AccountingPortal';
import { InventarioUnificado } from './InventarioUnificado';
import { WindowsModalProvider } from './WindowsModalContext';
import { WindowsTaskbar } from './WindowsTaskbar';
import { DraggableWindow } from './DraggableWindow';
import { InventariosLayout } from './inventarios/InventariosLayout';
export { DraggableWindow };

import { User } from '../../types';

interface AdminPortalProps {
    onExit: () => void;
    initialTab?: string;
    currentUser: User | null;
}

interface OpenTab {
    id: string;
    label: string;
    icon: any;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onExit, initialTab, currentUser }) => {
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [activeRibbonGroup, setActiveRibbonGroup] = useState('SISTEMA');
    const [isMaximized, setIsMaximized] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showActivityLog, setShowActivityLog] = useState(false);

    // Logging: Administrative Access
    useEffect(() => {
        if (currentUser) {
            activityLogService.log({
                user: currentUser,
                module: 'ADMIN',
                action: 'Ingreso a Panel Administrativo',
                details: {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }, []); // Only on mount
    const [iconTheme, setIconTheme] = useState<string>('classic');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    const [activeMobileGroup, setActiveMobileGroup] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data, error } = await supabase.from('system_settings').select('icon_theme').single();
            if (!error && data?.icon_theme) {
                setIconTheme(data.icon_theme);
            }
        };
        fetchConfig();

        // Suscribirse a cambios en la configuración en tiempo real
        const channel = supabase
            .channel('system_settings_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings' }, (payload) => {
                if (payload.new && payload.new.icon_theme) {
                    setIconTheme(payload.new.icon_theme);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);





    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hasPermission = (requiredPermission: string[]) => {
        if (!currentUser) return false;
        if (currentUser.role === 'ADMIN') return true;
        return requiredPermission.some(p => currentUser.permissions?.includes(p));
    };

    const TAB_PERMISSIONS: Record<string, string[]> = {
        'SYS_CONFIG': ['Configuración General:Acceso'],
        'SYS_SOUNDS': ['Configuración General:Acceso'],
        'ADMIN_USERS': ['Usuarios:Acceso'],
        'SYS_PERMS': ['Roles de Usuario:Acceso'],
        'SYS_BRANCHES': ['Sucursales:Acceso'],
        'CFG_KITCHEN': ['Cocinas:Acceso'],
        'CFG_CASH': ['Cajas:Acceso'],
        'ADMIN_SECTIONS': ['Secciones:Acceso'],
        'ADMIN_TABLES': ['Secciones:Acceso'],
        'CFG_PRINTERS': ['Puntos de Impresión:Acceso'],
        'CFG_POS': ['POS Tarjeta:Acceso'],
        'CFG_WAITER_ST': ['Estaciones:Acceso'],
        'CFG_DISCOUNTS': ['Tipos de Descuento:Acceso'],
        'CFG_PLATFORMS': ['Plataformas:Acceso'],
        'CFG_DELIVERY': ['Repartidores:Acceso'],
        'CFG_RECEIVABLE': ['Cuentas por Cobrar:Acceso'],
        'ADMIN_EXPENSES': ['Gastos:Acceso'],
        'ADMIN_MENU': ['Platillos y Bebidas:Acceso'],
        'DSH_PREVIEW': ['Platillos y Bebidas:Acceso'],
        'DSH_MOD_LIST': ['Modificadores:Acceso'],
        'DSH_MOD_GRP': ['Modificadores:Acceso'],
        'DSH_MOD_ASSIGN': ['Modificadores:Acceso'],
        'DSH_OPT_LIST': ['Opciones:Acceso'],
        'DSH_OPT_GRP': ['Opciones:Acceso'],
        'DSH_OPT_ASSIGN': ['Opciones:Acceso'],
        'INV_SUPPLIERS': ['Proveedores:Acceso'],
        'INV_PRODUCTS': ['Productos:Acceso'],
        'INV_PURCHASES': ['Compras:Acceso'],
        'INV_LEVELING': ['Nivelación de Inventarios:Acceso'],
        'INV_TRANSFER': ['Traslado de Productos:Acceso'],
        'INV_STOCK_SUC': ['Existencias de Inventario:Acceso'],
        'INV_STOCK_ALL': ['Existencias de Inventario:Acceso'],
        'INV_STOCK_REORDER': ['Existencias de Inventario:Acceso'],
        'INV_STOCK_DATE': ['Existencias de Inventario:Acceso'],
        'INV_PRODUCTION': ['Producción:Acceso'],
        'REP_GEN': ['Reportes:Reporte General'],
        'REP_SUC': ['Reportes:Reporte General Sucursales'],
        'REP_OPEN': ['Reportes:Ordenes Abiertas'],
        'REP_CLOSED': ['Reportes:Ordenes Cerradas'],
        'REP_CLOSED_CH': ['Reportes:Ordenes Cerradas'],
        'REP_CREDIT': ['Reportes:Ordenes Cerradas'],
        'REP_VOID': ['Reportes:Ordenes Anuladas'],
        'REP_DISC': ['Reportes:Ordenes con Descuento'],
        'REP_ALL': ['Reportes:Ordenes Cerradas'],
        'REP_DELIVERY': ['Reportes:Ordenes Cerradas'],
        'REP_INV': ['Reportes:Facturas'],
        'REP_INV_VOID': ['Reportes:Facturas Anuladas'],
        'REP_INV_CONT': ['Reportes:Facturas'],
        'REP_SOLD_GEN': ['Reportes:Platillos Vendidos General'],
        'REP_SOLD_USER': ['Reportes:Platillos Vendidos por Usuario'],
        'REP_DELETED': ['Reportes:Platillos Eliminados'],
        'REP_BILLED': ['Reportes:Platillos Vendidos General'],
        'REP_CASH_CUT': ['Reportes:Reporte General'],
        'REP_CASH_IN': ['Reportes:Reporte General'],
        'REP_CASH_OTHER': ['Reportes:Reporte General'],
        'REP_WAITER': ['Reportes:Propinas'],
        'DASH_CASH': ['Reportes:Ingresos a Caja'],
        'DASH_INVOICE': ['Reportes:Dashboards'],
        'DASH_SALES': ['Reportes:Dashboards'],
        'DASH_DISHES': ['Reportes:Dashboards'],
        'DASH_EXPENSES': ['Reportes:Dashboards'],
        'STRAT_MENU_ENG': ['Reportes:Dashboards'],
        'STRAT_COSTING': ['Reportes:Dashboards'],
        'STRAT_COST_CONTROL': ['Reportes:Dashboards'],
        'KITCHEN_PERF': ['Reportes:Dashboards'],
        'PROD_REND': ['Reportes:Dashboards'],
        'ACCT_HOME': ['Reportes:Dashboards'],
        'REP_ACTIVITY': ['Reportes:Auditoria'],
        'SYS_ORGS': ['SuperAdmin:Acceso'],
    };

    interface MenuItem {
        id: string;
        label: string;
        icon: any;
        action?: () => void;
        section?: string;
        compact?: boolean;
    }

    interface MenuSection {
        id: string;
        label: string;
        items: MenuItem[];
    }

    const MENU_STRUCTURE: MenuSection[] = [
        {
            id: 'SISTEMA',
            label: 'Sistema',
            items: [
                { id: 'SYS_CONFIG', label: 'Configuración General', icon: Settings },
                { id: 'SYS_SOUNDS', label: 'Alertas de Sonido KDS', icon: Volume2 },
                { id: 'ADMIN_USERS', label: 'Usuarios de Sistema', icon: Users },
                { id: 'SYS_PERMS', label: 'Roles y Permisos', icon: Shield },
                { id: 'SYS_BRANCHES', label: 'Sucursales', icon: Building },
                ...(currentUser?.is_superadmin ? [{ id: 'SYS_ORGS', label: 'Gestión de Empresas', icon: Building }] : []),
                { id: 'EXIT', label: 'Cerrar Aplicación', icon: LogOut, action: onExit },
            ]
        },
        {
            id: 'CONFIG',
            label: 'Configuraciones',
            items: [
                { id: 'CFG_KITCHEN', label: 'Cocinas', icon: ChefHat },
                { id: 'CFG_CASH', label: 'Cajas', icon: Wallet },
                { id: 'ADMIN_SECTIONS', label: 'Secciones y Mesas', icon: MapPin },
                { id: 'CFG_PRINTERS', label: 'Puntos de Impresión (Tablets)', icon: Printer },
                { id: 'CFG_POS', label: 'POS Tarjeta', icon: CreditCard },
                { id: 'CFG_WAITER_ST', label: 'Estaciones de Meseros', icon: Users },
                { id: 'CFG_DISCOUNTS', label: 'Tipo de Descuentos', icon: Percent },
                { id: 'CFG_PLATFORMS', label: 'Plataformas de Pedidos', icon: Globe },
                { id: 'CFG_DELIVERY', label: 'Mis Repartidores', icon: Bike },
                { id: 'CFG_RECEIVABLE', label: 'Cuentas por Cobrar', icon: Receipt },
                { id: 'ADMIN_EXPENSES', label: 'Gastos y Categorías', icon: Tag },
            ]
        },
        {
            id: 'DISHES',
            label: 'Platillos y Bebidas',
            items: [
                { id: 'ADMIN_MENU', label: 'Menú de Platillos', icon: Utensils, section: 'Menu' },
                { id: 'DSH_PREVIEW', label: 'Vista Previa de Menú', icon: Eye, section: 'Menu' },
                { id: 'DSH_MOD_LIST', label: 'Modificadores', icon: Puzzle, section: 'Modificadores' },
                { id: 'DSH_MOD_GRP', label: 'Agrupar Modificadores', icon: Boxes, section: 'Modificadores' },
                { id: 'DSH_MOD_ASSIGN', label: 'Asignar Modificadores', icon: Link, section: 'Modificadores' },
                { id: 'DSH_OPT_LIST', label: 'Opciones', icon: ListChecks, section: 'Opciones' },
                { id: 'DSH_OPT_GRP', label: 'Agrupar Opciones', icon: FolderTree, section: 'Opciones' },
                { id: 'DSH_OPT_ASSIGN', label: 'Asignar Opciones', icon: Tags, section: 'Opciones' },
            ]
        },
        {
            id: 'INVENTORY',
            label: 'Inventarios',
            items: [
                { id: 'INV_SUPPLIERS', label: 'Proveedores', icon: Truck, section: 'Materia Prima' },
                { id: 'INV_PRODUCTS', label: 'Productos', icon: Package, section: 'Materia Prima' },
                { id: 'INV_PURCHASES', label: 'Compras', icon: ShoppingCart, section: 'Movimientos de Inventario' },
                { id: 'INV_LEVELING', label: 'Nivelación', icon: Scale, section: 'Movimientos de Inventario' },
                { id: 'INV_TRANSFER', label: 'Traslado de Productos', icon: ArrowRightLeft, section: 'Movimientos de Inventario' },
                { id: 'INV_KARDEX', label: 'Kardex de Inventario', icon: FileCheck2, section: 'Reportes de Inventario' },
                { id: 'INV_STOCK_SUC', label: 'Existencias por Sucursal', icon: Layout, section: 'Existencias de Inventario' },
                { id: 'INV_STOCK_REORDER', label: 'Existencias en Punto de Reorden', icon: ArrowDownToLine, section: 'Existencias de Inventario' },
                { id: 'INV_STOCK_DATE', label: 'Existencias por Fecha', icon: CalendarDays, section: 'Existencias de Inventario' },
                { id: 'INV_PRODUCTION', label: 'Ordenes de Producción', icon: Wrench, section: 'Producción' },
                { id: 'INV_SUMINISTROS', label: 'Insumos y Suministros', icon: ShoppingCart, section: 'Suministros y Utensilios' },
                { id: 'INV_UTENSILIOS', label: 'Utensilios de Cocina', icon: Wrench, section: 'Suministros y Utensilios' },
            ]
        },
        {
            id: 'REPORTS',
            label: 'Reportes',
            items: [
                { id: 'REP_GEN', label: 'Reporte General', icon: PieChart, section: 'General de Ventas' },
                { id: 'REP_SUC', label: 'Reporte por Sucursal', icon: MapPin, section: 'General de Ventas' },
                { id: 'REP_OPEN', label: 'Órdenes Abiertas', icon: Clock, section: 'Órdenes y Cuentas' },
                { id: 'REP_CLOSED', label: 'Órdenes Cerradas', icon: FileCheck2, section: 'Órdenes y Cuentas' },
                { id: 'REP_CLOSED_CH', label: 'Cerradas por Canal', icon: BarChart3, section: 'Órdenes y Cuentas' },
                { id: 'REP_CREDIT', label: 'Órdenes Al Crédito', icon: CreditCardIcon, section: 'Órdenes y Cuentas' },
                { id: 'REP_VOID', label: 'Órdenes Anuladas', icon: AlertTriangle, section: 'Órdenes y Cuentas' },
                { id: 'REP_DISC', label: 'Órdenes con Descuentos', icon: BadgePercent, section: 'Órdenes y Cuentas' },
                { id: 'REP_ALL', label: 'Todas las Órdenes', icon: ListOrdered, section: 'Órdenes y Cuentas' },
                { id: 'REP_DELIVERY', label: 'Domicilio', icon: Bike, section: 'Órdenes y Cuentas' },
                { id: 'REP_SOLD_GEN', label: 'Platillos Vendidos General', icon: Utensils, section: 'Platillos' },
                { id: 'REP_SOLD_USER', label: 'Platillos por Usuario', icon: UserCheck, section: 'Platillos' },
                { id: 'REP_DELETED', label: 'Platillos Eliminados', icon: Trash, section: 'Platillos' },
                { id: 'REP_BILLED', label: 'Platillos Facturados', icon: ClipboardList, section: 'Platillos' },
                { id: 'REP_CASH_CUT', label: 'Cortes de Caja', icon: Scissors, section: 'Cajas', compact: true },
                { id: 'REP_CASH_IN', label: 'Ingresos a Caja', icon: ArrowDownToLine, section: 'Cajas', compact: true },
                { id: 'REP_CASH_OTHER', label: 'Ingresos Otros', icon: ArrowUpFromLine, section: 'Cajas', compact: true },
                { id: 'REP_INV', label: 'Facturas', icon: FileCheck, section: 'Facturas', compact: true },
                { id: 'REP_INV_VOID', label: 'Facturas Anuladas', icon: FileX, section: 'Facturas', compact: true },
                { id: 'REP_INV_UNFACT', label: 'Sin Facturar', icon: FileMinus2, section: 'Facturas', compact: true },
                { id: 'REP_ACTIVITY', label: 'Historial de Actividad', icon: Shield, section: 'Auditoría', compact: false },
                { id: 'REP_WAITER', label: 'Propinas de Meseros', icon: Users, section: 'Propinas' },
            ]
        },
        {
            id: 'DASHBOARDS',
            label: 'Dashboards',
            items: [
                { id: 'DASH_CASH', label: 'Ingresos a Caja', icon: Wallet },
                { id: 'DASH_INVOICE', label: 'Facturación', icon: FileText },
                { id: 'DASH_SALES', label: 'Ventas Rendimiento', icon: TrendingUp },
                { id: 'DASH_DISHES', label: 'Platos Rendimiento', icon: Utensils },
                { id: 'DASH_EXPENSES', label: 'Gastos', icon: PieChart },
            ]
        },
        {
            id: 'STRATEGY',
            label: 'Estrategia',
            items: [
                { id: 'STRAT_MENU_ENG', label: 'Ingeniería de Menús (Histórico)', icon: PieChart, section: 'Análisis de Rentabilidad' },
                { id: 'STRAT_COSTING', label: 'Ficha Técnica & Costeo', icon: TrendingUp, section: 'Estrategia de Precios' },
                { id: 'STRAT_COST_CONTROL', label: 'Control de Costos', icon: Calculator, section: 'Finanzas & Opex' },
                { id: 'KITCHEN_PERF', label: 'Rendimiento de Cocina', icon: ChefHat, section: 'KDS & Tiempos' },
                { id: 'PROD_REND', label: 'Rendimiento de Producción', icon: Layers, section: 'KDS & Tiempos' },
            ]
        },
        {
            id: 'CONTABILIDAD',
            label: 'Contabilidad',
            items: [
                { id: 'ACCT_HOME', label: 'Portal Contable', icon: Calculator, section: 'Contabilidad' },
            ]
        }
    ].map(group => ({
        ...group,
        items: group.items.filter(item => item.id === 'EXIT' || hasPermission(TAB_PERMISSIONS[item.id] || []))
    })).filter(group => group.items.length > 0);

    const openModule = (item: any) => {
        if (item.action) {
            item.action();
            return;
        }

        if (item.id === 'SYS_CONFIG') {
            setShowConfigModal(true);
            return;
        }

        if (item.id === 'DSH_PREVIEW') {
            setShowPreviewModal(true);
            return;
        }

        if (!openTabs.some(t => t.id === item.id)) {
            setOpenTabs([...openTabs, { id: item.id, label: item.label, icon: item.icon }]);
        }
        setActiveTabId(item.id);
    };

    useEffect(() => {
        if (initialTab) {
            const group = MENU_STRUCTURE.find(g => g.items.some(i => i.id === initialTab));
            if (group) {
                setActiveRibbonGroup(group.id);
                const item = group.items.find(i => i.id === initialTab);
                if (item) openModule(item);
            }
        } else {
            // No abrir ningún módulo por defecto para evitar pantallas emergentes al entrar
            // const defaultItem = MENU_STRUCTURE[0].items.find(i => i.id === 'ADMIN_USERS');
            // if (defaultItem) openModule(defaultItem);
        }
    }, [initialTab]);

    const closeModule = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newTabs = openTabs.filter(t => t.id !== id);
        setOpenTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }
    };

    const renderIcon = (item: any, size = 18) => {
        const Icon = item.icon;
        const isActive = activeTabId === item.id;

        return (
            <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon size={size} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#106ebe]' : 'text-slate-400 group-hover:text-slate-600'} />
            </div>
        );
    };

    const renderTabContent = (tabId: string) => {
        const appliedSearch = searchQuery;
        
        switch (tabId) {
            case 'SYS_CONFIG': return (
                <DraggableWindow id="sys-config" title="Configuración del Sistema">
                     <SystemConfig 
                        onClose={() => setShowConfigModal(false)} 
                        onThemeChange={(theme: string) => setIconTheme(theme)} 
                        currentTheme={iconTheme} 
                    />
                </DraggableWindow>
            );
            case 'SYS_SOUNDS': return <ConfigSoundsCard />;
            case 'CFG_KITCHEN': return <KitchensAdmin />;
            case 'CFG_CASH': return <CajasAdmin />;
            case 'SYS_PERMS': return <AdminRoles />;
            case 'SYS_BRANCHES': return <BranchesAdmin />;
            case 'SYS_ORGS': return <OrganizationsAdmin />;
            case 'CFG_DISCOUNTS': return <ConfigDiscounts />;
            case 'CFG_PLATFORMS': return <ConfigPlatforms />;
            case 'CFG_DELIVERY': return <ConfigDrivers />;
            case 'CFG_POS': return <ConfigPosCard />;
            case 'CFG_PRINTERS': return <ConfigPrinters />;
            case 'CFG_WAITER_ST': return <ConfigWaiters />;
            case 'CFG_RECEIVABLE': return <ConfigReceivable />;
            case 'REP_CASH_CUT':
            case 'REP_CASH': return <ReportCaja key={tabId} />;
            case 'REP_CASH_OTHER':
            case 'REP_CASH_IN': return <ReportIngresosCaja key={tabId} mode={tabId as any} />;
            case 'REP_SUC': return <ReportBranch key={tabId} />;
            case 'REP_WAITER': return <ReportPropinas key={tabId} />;
            case 'REP_BILLED':
            case 'REP_SOLD_GEN':
            case 'REP_SOLD_USER':
            case 'REP_DELETED': return <ReportSoldItems key={tabId} mode={tabId || 'REP_SOLD_GEN'} />;
            case 'REP_GEN': return <ReportGeneral key={tabId} />;
            case 'DASH_SALES': return <DashboardVentasRendimiento key={tabId} />;
            case 'DASH_INVOICE': return <DashboardFacturacion key={tabId} />;
            case 'DASH_CASH': return <DashboardIngresosCaja key={tabId} />;
            case 'DASH_DISHES': return <DashboardDishes />;
            case 'DASH_EXPENSES': return <DashboardExpenses />;
            case 'REP_OPEN':
            case 'REP_CLOSED':
            case 'REP_CLOSED_CH':
            case 'REP_CREDIT':
            case 'REP_ALL':
            case 'REP_DELIVERY':
            case 'REP_VOID':
            case 'REP_DISC': return <ReportOrders key={tabId} mode={tabId || 'REP_OPEN'} />;
            case 'REP_INV':
            case 'REP_INV_VOID':
            case 'REP_INV_CONT': return <ReportFacturas key={tabId} mode={tabId as any} />;
            case 'REP_INV_UNFACT': return <ReportOrders key={tabId} mode={tabId || 'REP_OPEN'} />;
            case 'DSH_MOD_GRP':
                return <DishesModifiers />;
            case 'DSH_MOD_LIST':
                return <DishesModifiersList />;
            case 'DSH_MOD_ASSIGN':
                return <DishesModifiersAssign />;
            case 'DSH_OPT_GRP':
                return <DishesOptions />;
            case 'DSH_OPT_LIST':
                return <DishesOptionsList />;
            case 'DSH_OPT_ASSIGN':
                return <DishesOptionsAssign />;
            case 'INV_SUPPLIERS': return <SuppliersAdmin />;
            case 'INV_PRODUCTS': return <InventariosLayout initialTab="productos" />;
            case 'INV_STOCK_SUC':
            case 'INV_STOCK_ALL':
            case 'INV_STOCK_REORDER':
            case 'INV_STOCK_DATE':
            case 'INV_STOCK': return <InventoryStock mode={tabId || undefined} />;
            case 'INV_PURCHASES': return <InventoryPurchases currentUser={currentUser} />;
            case 'INV_TRANSFER': return <InventoryTransfer />;
            case 'INV_LEVELING': return <InventoryLeveling currentUser={currentUser} />;
            case 'INV_KARDEX': return <InventoryKardex currentUser={currentUser} />;
            case 'INV_PRODUCTION': return <InventoryProduction />;
            case 'INV_SUMINISTROS': return <InventarioUnificado initialTab="insumo" />;
            case 'INV_UTENSILIOS': return <InventarioUnificado initialTab="utensilio" />;
            case 'ADMIN_USERS': return <UsuariosAdmin globalSearch={appliedSearch} />;
            case 'ADMIN_MENU': return <InventariosLayout initialTab="platillos" />;
            case 'ADMIN_CATS': return <CategoriesAdmin />;
            case 'ADMIN_EXPENSES': return <ExpensesAdmin currentUser={currentUser} />;
            case 'ADMIN_TABLES': return <TablesAdmin />;
            case 'ADMIN_SECTIONS': return <SectionsTablesAdmin />;
            case 'STRAT_MENU_ENG': return <MenuEngineeringModal onClose={() => { }} isStandalone={true} />;
            case 'STRAT_COSTING': return <MenuCosting />;
            case 'STRAT_COST_CONTROL': return <CostControl />;
            case 'KITCHEN_PERF': return <KitchenPerformanceReport />;
            case 'PROD_REND': return <RendimientoProduccion />;
            case 'ACCT_HOME': return <AccountingPortal />;
            case 'REP_ACTIVITY': return <ActivityHistoryDashboard />;
            default: return null;
        }
    };

    const BottomNavigation = () => {
        const items = [
            { id: 'HOME', label: 'Inicio', icon: Layout, action: () => { setActiveTabId(null); setActiveMobileGroup(null); } },
            { id: 'TABLES', label: 'Mesas', icon: MapPin, action: onExit },
            { id: 'REPORTS', label: 'Reportes', icon: FileText, action: () => { setActiveRibbonGroup('REPORTS'); setActiveMobileGroup('REPORTS'); setActiveTabId(null); } },
            { id: 'EXIT', label: 'Salir', icon: LogOut, action: onExit },
        ];

        return (
            <div className="mobile-bottom-nav">
                {items.map(item => {
                    const isActive = (item.id === 'HOME' && !activeTabId && !activeMobileGroup) ||
                        (item.id === 'REPORTS' && activeMobileGroup === 'REPORTS' && !activeTabId);
                    return (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <WindowsModalProvider>
            <div className={`h-full w-full flex flex-col bg-[#e6e6e6] overflow-hidden transition-all duration-500 scale-in ${isMinimized ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                {/* Ribbon Menu Modern - Hidden on Mobile */}
                {!isMobile && (
                    <div className="bg-white border-b border-gray-100 shrink-0 shadow-sm relative z-30 font-sans">
                        <div className="flex items-center px-4 pt-1 gap-1">
                            {MENU_STRUCTURE.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveRibbonGroup(group.id)}
                                    className={`px-5 py-2 text-[11px] font-bold rounded-t-lg transition-all ${activeRibbonGroup === group.id
                                        ? 'bg-[#f0f0f0] text-[#106ebe] border-x border-t border-gray-300 shadow-sm font-black'
                                        : 'text-gray-400 hover:bg-gray-50'
                                        }`}
                                >
                                    {group.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-[#f0f0f0] p-1 pr-4 flex items-center gap-0.5 min-h-[88px] overflow-x-auto scrollbar-hide border-b border-gray-300">
                            {(() => {
                                const group = MENU_STRUCTURE.find(g => g.id === activeRibbonGroup);
                                if (!group) return null;

                                const sections: { [key: string]: any[] } = {};
                                group.items.forEach(item => {
                                    const s = item.section || 'General';
                                    if (!sections[s]) sections[s] = [];
                                    sections[s].push(item);
                                });

                                return Object.entries(sections).map(([name, secItems], idx) => {
                                    const isCompact = secItems.some((i: any) => i.compact);
                                    return (
                                        <React.Fragment key={name}>
                                            <div className="flex flex-col items-center self-stretch justify-between">
                                                <div className="flex-1 flex items-center justify-center">
                                                    {isCompact ? (
                                                        <div className="flex flex-col gap-0.5 justify-center h-full py-0.5 items-start">
                                                            {secItems.map((item: any) => {
                                                                const IC = item.icon;
                                                                const isAct = activeTabId === item.id;
                                                                return (
                                                                    <button
                                                                        key={item.id}
                                                                        onClick={() => openModule(item)}
                                                                        title={item.label}
                                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all group ${isAct
                                                                            ? 'bg-[#106ebe] text-white'
                                                                            : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                                                                            }`}
                                                                    >
                                                                        <IC size={11} strokeWidth={isAct ? 2.5 : 2} className={`shrink-0 ${isAct ? 'text-white' : 'text-gray-400'}`} />
                                                                        <span className="text-[8.5px] font-bold uppercase tracking-tight leading-tight">{item.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-1 px-1">
                                                            {secItems.map((item: any) => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => openModule(item)}
                                                                    title={item.label}
                                                                    className={`flex flex-col items-center w-[76px] h-[74px] rounded-lg transition-all group relative
                                                                        ${activeTabId === item.id
                                                                            ? 'bg-white shadow-sm ring-1 ring-gray-200'
                                                                            : 'border-2 border-transparent hover:bg-white/60'}
                                                                    `}
                                                                >
                                                                    <div className="flex items-center justify-center w-full pt-2 pb-0.5 shrink-0">
                                                                        {renderIcon(item, 24)}
                                                                    </div>
                                                                    <div className="flex items-center justify-center w-full px-1 flex-1 min-h-[30px] pb-1">
                                                                        <span className={`text-[6.8px] font-bold text-center leading-[1] uppercase w-full ${activeTabId === item.id ? 'text-[#106ebe]' : 'text-gray-500 group-hover:text-gray-700'
                                                                            }`}>
                                                                            {item.label}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-[8px] font-black uppercase text-gray-400 tracking-[0.2em]">{name}</div>
                                            </div>
                                            {idx < Object.entries(sections).length - 1 && (
                                                <div className="h-14 w-px bg-gray-300 mx-1.5 self-center" />
                                            )}
                                        </React.Fragment>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}

                {/* Document Tab Bar Modern - Hidden on Mobile */}
                {!isMobile && (
                    <div className="bg-[#f0f0f0] border-b border-gray-300 flex items-center h-10 px-4 gap-1 shrink-0 overflow-x-auto scrollbar-hide shadow-[inset_0_-1px_0_#fff]">
                        {openTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                className={`flex items-center gap-2 px-4 h-[32px] self-end text-[11px] font-bold transition-all group min-w-[140px] border-t border-x rounded-t ${activeTabId === tab.id
                                    ? 'bg-white text-[#106ebe] border-gray-300 border-t-2 border-t-[#106ebe] shadow-[inset_1px_1px_0_#fff] z-10 h-[34px]'
                                    : 'bg-[#e0e0e0] text-slate-500 border-gray-300 hover:bg-[#d5d5d5]'
                                    }`}
                            >
                                <tab.icon size={14} className={activeTabId === tab.id ? 'text-[#106ebe]' : 'text-slate-400'} />
                                <span className={`truncate flex-1 text-left ${activeTabId === tab.id ? 'text-[#106ebe]' : 'text-slate-700'}`}>{tab.label}</span>
                                <div
                                    onClick={(e) => closeModule(e, tab.id)}
                                    className={`p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${activeTabId === tab.id ? 'hover:bg-[#106ebe]/10 text-[#106ebe]' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                                >
                                    <X size={12} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Main View Area Modern */}
                <div className={`flex-1 overflow-hidden relative z-[40] bg-[#fcfdfe] ${isMobile ? 'main-content-mobile select-none' : ''}`}>
                    <div className="absolute inset-0 overflow-hidden">
                        {openTabs.length > 0 ? (
                            <div className="h-full relative">
                                {openTabs.map(tab => (
                                    <div 
                                        key={tab.id} 
                                        className={`absolute inset-0 transition-opacity duration-200 ${activeTabId === tab.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                                        style={{ visibility: activeTabId === tab.id ? 'visible' : 'hidden' }}
                                    >
                                        {renderTabContent(tab.id)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                                <div className={`h-full overflow-y-auto ${isMobile ? 'pb-12 bg-white' : 'flex flex-col items-center justify-center bg-[#f0f0f0] text-slate-400'}`}>
                                {isMobile ? (
                                    <div className="animate-fade-in p-6">
                                        {!activeMobileGroup ? (
                                            /* CATEGORY GRID (3x2) */
                                            <>
                                                <div className="mb-8">
                                                    <h2 className="text-[22px] font-black text-slate-800 leading-tight tracking-tight">PORTAL<br />ADMINISTRATIVO</h2>
                                                    <div className="w-12 h-1 bg-[#4f46e5] rounded-full mt-3" />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {MENU_STRUCTURE.map(group => (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => setActiveMobileGroup(group.id)}
                                                            className="flex flex-col items-center justify-center aspect-square p-4 bg-slate-50 border border-slate-100 rounded-3xl active:scale-95 active:bg-slate-100 transition-all text-center"
                                                        >
                                                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#4f46e5] mb-3">
                                                                {(() => {
                                                                    const Icon = group.items[0]?.icon || Layout;
                                                                    return <Icon size={28} />;
                                                                })()}
                                                            </div>
                                                            <span className="text-[11px] font-black text-slate-700 uppercase leading-none tracking-tight">
                                                                {group.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            /* MODULE LIST FOR CATEGORY */
                                            <>
                                                <div className="flex items-center gap-3 mb-8">
                                                    <button
                                                        onClick={() => setActiveMobileGroup(null)}
                                                        className="p-2 -ml-2 text-slate-400 active:text-[#4f46e5]"
                                                    >
                                                        <X size={24} className="rotate-90" />
                                                    </button>
                                                    <div>
                                                        <h2 className="text-[18px] font-black text-slate-800 uppercase tracking-tight">
                                                            {MENU_STRUCTURE.find(g => g.id === activeMobileGroup)?.label}
                                                        </h2>
                                                        <span className="text-[10px] font-bold text-[#4f46e5] uppercase tracking-widest leading-none">SELECCIONE MÓDULO</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    {MENU_STRUCTURE.find(g => g.id === activeMobileGroup)?.items.map(item => {
                                                        const IC = item.icon;
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => openModule(item)}
                                                                className="flex items-center gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl active:bg-slate-100 transition-all text-left"
                                                            >
                                                                <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[#4f46e5]">
                                                                    <IC size={24} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-[13px] font-bold text-slate-800 uppercase leading-none mb-1">{item.label}</h4>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.section || 'Módulo'}</span>
                                                                </div>
                                                                <ChevronDown size={16} className="-rotate-90 text-slate-300" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <Monitor size={64} className="mb-4 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Seleccione un módulo para comenzar</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Navigation for Mobile - Moved Outside for proper Fixed positioning */}
            {isMobile && <BottomNavigation />}

            {/* Floating Windows Layer */}
            {showConfigModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <SystemConfig
                                onClose={() => setShowConfigModal(false)}
                                onThemeChange={(theme: string) => setIconTheme(theme)}
                                currentTheme={iconTheme}
                            />
                        </DraggableWindow>
                    </div>
                </div>
            )}

            {showPreviewModal && (
                <div className="fixed inset-0 z-[99998] flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto w-full max-w-5xl h-[85vh]">
                        <MenuPreview onClose={() => setShowPreviewModal(false)} />
                    </div>
                </div>
            )}

            {/* BARRA DE TAREAS GLOBAL REMOVED AS PER USER REQUEST - Windows don't have minimize buttons */}
            {/* <WindowsTaskbar /> */}

            <style>{`
                .pointer-events-auto { pointer-events: auto; }
                .pointer-events-none { pointer-events: none; }
                .scale-in { animation: scaleIn 0.3s ease-out forwards; }
                @keyframes scaleIn { from { transform: scale(0.98); opacity: 0; } to { opacity: 1; } }
            `}</style>
        </WindowsModalProvider>
    );
};
