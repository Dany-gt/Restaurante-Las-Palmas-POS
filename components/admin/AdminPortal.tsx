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
import { PremiumIcon, ICON_MAP } from '../shared/PremiumIcon';
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
import { AdminNotifications } from './AdminNotifications';
export { DraggableWindow };

import { User } from '../../types';

interface AdminPortalProps {
    onExit: () => void;
    onNavigate?: (view: string) => void;
    initialTab?: string;
    currentUser: User | null;
}

interface OpenTab {
    id: string;
    label: string;
    icon: any;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onExit, onNavigate, initialTab, currentUser }) => {
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

    // Logging: Administrative Access — only ONCE per session, not on every re-render
    const hasLoggedAccess = React.useRef(false);
    useEffect(() => {
        if (currentUser && !hasLoggedAccess.current) {
            hasLoggedAccess.current = true;
            activityLogService.log({
                user: currentUser,
                module: 'ADMIN',
                action: 'ACCESO_ADMIN',
                details: {
                    description: 'Ingreso a Panel Administrativo',
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
        if (currentUser.role?.toUpperCase() === 'ADMIN' || currentUser.originalRole?.toUpperCase() === 'ADMIN') return true;
        if ((currentUser.role?.toUpperCase() === 'SUPERVISOR' || currentUser.originalRole?.toUpperCase() === 'SUPERVISOR') && requiredPermission.length === 0) return true;
        return requiredPermission.some(p => currentUser.permissions?.includes(p));
    };

    const TAB_PERMISSIONS: Record<string, string[]> = {
        'ADMIN_AUTH': [], // Autorizaciones remotas: solo ADMIN (y SUPERVISOR si queremos)
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
        iconify?: string;
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
                { id: 'ADMIN_AUTH', label: 'Autorizaciones Remotas', icon: Shield, iconify: ICON_MAP.AUTH, action: () => onNavigate?.('ADMIN_AUTH_PANEL') },
                { id: 'SYS_CONFIG', label: 'Configuración General', icon: Settings, iconify: ICON_MAP.ADMIN_CONFIG },
                { id: 'SYS_SOUNDS', label: 'Alertas de Sonido KDS', icon: Volume2, iconify: ICON_MAP.SOUNDS },
                { id: 'ADMIN_USERS', label: 'Usuarios de Sistema', icon: Users, iconify: ICON_MAP.CFG_USERS },
                { id: 'SYS_PERMS', label: 'Roles y Permisos', icon: Shield, iconify: ICON_MAP.ADMIN_SYS },
                { id: 'SYS_BRANCHES', label: 'Sucursales', icon: Building, iconify: ICON_MAP.CFG_SECTIONS },
                ...(currentUser?.is_superadmin ? [{ id: 'SYS_ORGS', label: 'Gestión de Empresas', icon: Building, iconify: ICON_MAP.CFG_SECTIONS }] : []),
                { id: 'EXIT', label: 'Cerrar Aplicación', icon: LogOut, iconify: ICON_MAP.LOGOUT, action: onExit },
            ]
        },
        {
            id: 'CONFIG',
            label: 'Configuraciones',
            items: [
                { id: 'CFG_KITCHEN', label: 'Cocinas', icon: ChefHat, iconify: ICON_MAP.CFG_KITCHEN },
                { id: 'CFG_CASH', label: 'Cajas', icon: Wallet, iconify: ICON_MAP.CFG_CASH },
                { id: 'ADMIN_SECTIONS', label: 'Secciones y Mesas', icon: MapPin, iconify: ICON_MAP.CFG_SECTIONS },
                { id: 'CFG_PRINTERS', label: 'Puntos de Impresión (Tablets)', icon: Printer, iconify: ICON_MAP.CFG_PRINTERS },
                { id: 'CFG_POS', label: 'POS Tarjeta', icon: CreditCard, iconify: ICON_MAP.CFG_POS },
                { id: 'CFG_WAITER_ST', label: 'Estaciones de Meseros', icon: Users, iconify: ICON_MAP.CFG_USERS },
                { id: 'CFG_DISCOUNTS', label: 'Tipo de Descuentos', icon: Percent, iconify: ICON_MAP.CFG_DISCOUNTS },
                { id: 'CFG_PLATFORMS', label: 'Plataformas de Pedidos', icon: Globe, iconify: ICON_MAP.CFG_PLATFORMS },
                { id: 'CFG_DELIVERY', label: 'Mis Repartidores', icon: Bike, iconify: ICON_MAP.CFG_DRIVERS },
                { id: 'CFG_RECEIVABLE', label: 'Cuentas por Cobrar', icon: Receipt, iconify: ICON_MAP.CFG_RECEIVABLE },
                { id: 'ADMIN_EXPENSES', label: 'Gastos y Categorías', icon: Tag, iconify: ICON_MAP.CFG_EXPENSES },
            ]
        },
        {
            id: 'DISHES',
            label: 'Platillos y Bebidas',
            items: [
                { id: 'ADMIN_MENU', label: 'Menú de Platillos', icon: Utensils, iconify: ICON_MAP.MENU_LIST, section: 'Menu' },
                { id: 'DSH_PREVIEW', label: 'Vista Previa de Menú', icon: Eye, iconify: ICON_MAP.MENU_PREVIEW, section: 'Menu' },
                { id: 'DSH_MOD_LIST', label: 'Modificadores', icon: Puzzle, iconify: ICON_MAP.MENU_MODS, section: 'Modificadores' },
                { id: 'DSH_MOD_GRP', label: 'Agrupar Modificadores', icon: Boxes, iconify: ICON_MAP.MENU_MODS_GRP, section: 'Modificadores' },
                { id: 'DSH_MOD_ASSIGN', label: 'Asignar Modificadores', icon: Link, iconify: ICON_MAP.MENU_MODS_ASG, section: 'Modificadores' },
                { id: 'DSH_OPT_LIST', label: 'Opciones', icon: ListChecks, iconify: ICON_MAP.MENU_OPTS, section: 'Opciones' },
                { id: 'DSH_OPT_GRP', label: 'Agrupar Opciones', icon: FolderTree, iconify: ICON_MAP.MENU_OPTS_GRP, section: 'Opciones' },
                { id: 'DSH_OPT_ASSIGN', label: 'Asignar Opciones', icon: Tags, iconify: ICON_MAP.MENU_OPTS_ASG, section: 'Opciones' },
            ]
        },
        {
            id: 'INVENTORY',
            label: 'Inventarios',
            items: [
                { id: 'INV_SUPPLIERS', label: 'Proveedores', icon: Truck, iconify: ICON_MAP.INV_SUPPLIERS, section: 'Materia Prima' },
                { id: 'INV_PRODUCTS', label: 'Productos', icon: Package, iconify: ICON_MAP.INV_PRODUCTS, section: 'Materia Prima' },
                { id: 'INV_PURCHASES', label: 'Compras', icon: ShoppingCart, iconify: ICON_MAP.INV_PURCHASES, section: 'Movimientos de Inventario' },
                { id: 'INV_LEVELING', label: 'Nivelación', icon: Scale, iconify: ICON_MAP.INV_LEVELING, section: 'Movimientos de Inventario' },
                { id: 'INV_TRANSFER', label: 'Traslado de Productos', icon: ArrowRightLeft, iconify: ICON_MAP.INV_TRANSFER, section: 'Movimientos de Inventario' },
                { id: 'INV_KARDEX', label: 'Kardex de Inventario', icon: FileCheck2, iconify: ICON_MAP.INV_KARDEX, section: 'Reportes de Inventario' },
                { id: 'INV_STOCK_SUC', label: 'Existencias por Sucursal', icon: Layout, iconify: ICON_MAP.INV_STOCK_SUC, section: 'Existencias de Inventario' },
                { id: 'INV_STOCK_REORDER', label: 'Existencias en Punto de Reorden', icon: ArrowDownToLine, iconify: ICON_MAP.INV_STOCK_REORDER, section: 'Existencias de Inventario' },
                { id: 'INV_STOCK_DATE', label: 'Existencias por Fecha', icon: CalendarDays, iconify: ICON_MAP.INV_STOCK_DATE, section: 'Existencias de Inventario' },
                { id: 'INV_PRODUCTION', label: 'Ordenes de Producción', icon: Wrench, iconify: ICON_MAP.INV_PRODUCTION, section: 'Producción' },
                { id: 'INV_SUMINISTROS', label: 'Insumos y Suministros', icon: ShoppingCart, iconify: ICON_MAP.SUMINISTROS, section: 'Suministros y Utensilios' },
                { id: 'INV_UTENSILIOS', label: 'Utensilios de Cocina', icon: Wrench, iconify: ICON_MAP.UTENSILIOS, section: 'Suministros y Utensilios' },
            ]
        },
        {
            id: 'REPORTS',
            label: 'Reportes',
            items: [
                { id: 'REP_GEN', label: 'Reporte General', icon: PieChart, iconify: ICON_MAP.REP_CHART_PIE, section: 'General de Ventas' },
                { id: 'REP_SUC', label: 'Reporte por Sucursal', icon: MapPin, iconify: ICON_MAP.REP_CHART_BAR, section: 'General de Ventas' },
                { id: 'REP_OPEN', label: 'Órdenes Abiertas', icon: Clock, iconify: ICON_MAP.REP_OPEN, section: 'Órdenes y Cuentas' },
                { id: 'REP_CLOSED', label: 'Órdenes Cerradas', icon: FileCheck2, iconify: ICON_MAP.REP_CLOSED, section: 'Órdenes y Cuentas' },
                { id: 'REP_CLOSED_CH', label: 'Cerradas por Canal', icon: BarChart3, iconify: ICON_MAP.REP_CLOSED_CH, section: 'Órdenes y Cuentas' },
                { id: 'REP_CREDIT', label: 'Órdenes Al Crédito', icon: CreditCardIcon, iconify: ICON_MAP.REP_CREDIT, section: 'Órdenes y Cuentas' },
                { id: 'REP_VOID', label: 'Órdenes Anuladas', icon: AlertTriangle, iconify: ICON_MAP.REP_VOID, section: 'Órdenes y Cuentas' },
                { id: 'REP_DISC', label: 'Órdenes con Descuentos', icon: BadgePercent, iconify: ICON_MAP.REP_DISC, section: 'Órdenes y Cuentas' },
                { id: 'REP_ALL', label: 'Todas las Órdenes', icon: ListOrdered, iconify: ICON_MAP.REP_ALL, section: 'Órdenes y Cuentas' },
                { id: 'REP_DELIVERY', label: 'Domicilio', icon: Bike, iconify: ICON_MAP.REP_DELIVERY, section: 'Órdenes y Cuentas' },
                { id: 'REP_SOLD_GEN', label: 'Platillos Vendidos General', icon: Utensils, iconify: ICON_MAP.REP_SOLD_GEN, section: 'Platillos' },
                { id: 'REP_SOLD_USER', label: 'Platillos por Usuario', icon: UserCheck, iconify: ICON_MAP.REP_SOLD_USER, section: 'Platillos' },
                { id: 'REP_DELETED', label: 'Platillos Eliminados', icon: Trash, iconify: ICON_MAP.TRASH, section: 'Platillos' },
                { id: 'REP_BILLED', label: 'Platillos Facturados', icon: ClipboardList, iconify: ICON_MAP.REP_INVOICE, section: 'Platillos' },
                { id: 'REP_CASH_CUT', label: 'Cortes de Caja', icon: Scissors, iconify: ICON_MAP.REP_CASH, section: 'Cajas', compact: true },
                { id: 'REP_CASH_IN', label: 'Ingresos a Caja', icon: ArrowDownToLine, iconify: ICON_MAP.REP_STATS, section: 'Cajas', compact: true },
                { id: 'REP_CASH_OTHER', label: 'Ingresos Otros', icon: ArrowUpFromLine, iconify: ICON_MAP.REP_CHART_BAR, section: 'Cajas', compact: true },
                { id: 'REP_INV', label: 'Facturas', icon: FileCheck, iconify: ICON_MAP.REP_INVOICE, section: 'Facturas', compact: true },
                { id: 'REP_INV_VOID', label: 'Facturas Anuladas', icon: FileX, iconify: ICON_MAP.REP_CHART_LINE, section: 'Facturas', compact: true },
                { id: 'REP_INV_UNFACT', label: 'Sin Facturar', icon: FileMinus2, iconify: ICON_MAP.REP_CHART_PIE, section: 'Facturas', compact: true },
                { id: 'REP_ACTIVITY', label: 'Historial de Actividad', icon: Shield, iconify: ICON_MAP.ADMIN_CONFIG, section: 'Auditoría', compact: false },
                { id: 'REP_WAITER', label: 'Propinas de Meseros', icon: Users, iconify: ICON_MAP.WAITERS, section: 'Propinas' },
            ]
        },
        {
            id: 'DASHBOARDS',
            label: 'Dashboards',
            items: [
                { id: 'DASH_CASH', label: 'Ingresos a Caja', icon: Wallet, iconify: ICON_MAP.DASH_CASH },
                { id: 'DASH_INVOICE', label: 'Facturación', icon: FileText, iconify: ICON_MAP.DASH_INVOICE },
                { id: 'DASH_SALES', label: 'Ventas Rendimiento', icon: TrendingUp, iconify: ICON_MAP.DASH_SALES },
                { id: 'DASH_DISHES', label: 'Platos Rendimiento', icon: Utensils, iconify: ICON_MAP.DASH_DISHES },
                { id: 'DASH_EXPENSES', label: 'Gastos', icon: PieChart, iconify: ICON_MAP.DASH_EXPENSES },
            ]
        },
        {
            id: 'STRATEGY',
            label: 'Estrategia',
            items: [
                { id: 'STRAT_MENU_ENG', label: 'Ingeniería de Menús (Histórico)', icon: PieChart, iconify: ICON_MAP.STRAT_MENU, section: 'Análisis de Rentabilidad' },
                { id: 'STRAT_COSTING', label: 'Ficha Técnica & Costeo', icon: TrendingUp, iconify: ICON_MAP.STRAT_COSTS, section: 'Estrategia de Precios' },
                { id: 'STRAT_COST_CONTROL', label: 'Control de Costos', icon: Calculator, iconify: ICON_MAP.STRAT_FINANCE, section: 'Finanzas & Opex' },
                { id: 'KITCHEN_PERF', label: 'Rendimiento de Cocina', icon: ChefHat, iconify: ICON_MAP.STRAT_KITCHEN, section: 'KDS & Tiempos' },
                { id: 'PROD_REND', label: 'Rendimiento de Producción', icon: Layers, iconify: ICON_MAP.STRAT_PROD, section: 'KDS & Tiempos' },
            ]
        },
        {
            id: 'CONTABILIDAD',
            label: 'Contabilidad',
            items: [
                { id: 'ACCT_HOME', label: 'Portal Contable', icon: Calculator, iconify: ICON_MAP.ACCT_PORTAL, section: 'Contabilidad' },
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

        // Log specific module access
        if (currentUser) {
            activityLogService.log({
                user: currentUser,
                module: 'ADMIN',
                action: 'MODULO_ABIERTO',
                details: {
                    modulo_id: item.id,
                    modulo_nombre: item.label,
                    seccion: item.section || 'General'
                }
            });
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
    const renderIcon = (item: any, size: number) => {
        const Icon = item.icon;
        const isActive = activeTabId === item.id;

        if (iconTheme === 'premium' && item.iconify) {
            return (
                <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <PremiumIcon icon={item.iconify} size={size} />
                </div>
            );
        }

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
            case 'INV_PRODUCTS': return <InventariosLayout initialTab="productos" iconTheme={iconTheme} currentUser={currentUser} />;
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
            case 'ADMIN_MENU': return <InventariosLayout initialTab="platillos" iconTheme={iconTheme} currentUser={currentUser} />;
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
                    <div className="bg-[#106ebe] shrink-0 relative z-30 font-sans">
                        <div className="flex items-center gap-0">
                            {MENU_STRUCTURE.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveRibbonGroup(group.id)}
                                    className={`px-5 h-8 flex items-center text-[11px] font-medium transition-all ${activeRibbonGroup === group.id
                                        ? 'bg-[#f3f4f6] text-[#106ebe] font-semibold'
                                        : 'bg-[#106ebe] text-blue-100 hover:bg-[#1a7bc9]'
                                        }`}
                                >
                                    {group.label}
                                </button>
                            ))}

                            <div className="flex-1" />
                        </div>

                        <div className="bg-[#f3f4f6] p-1 pr-4 flex items-center gap-0.5 min-h-[92px] overflow-x-auto scrollbar-hide border-b border-gray-300 shadow-sm relative z-10">
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
                                                                        className={`flex items-center gap-1.5 px-3 py-1 transition-all group ${isAct
                                                                            ? 'bg-[#106ebe] text-white shadow-sm'
                                                                            : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                                                                            }`}
                                                                    >
                                                                        {iconTheme === 'premium' && item.iconify ? (
                                                                            <PremiumIcon icon={item.iconify} size={18} className="shrink-0" />
                                                                        ) : (
                                                                            <IC size={11} strokeWidth={isAct ? 2.5 : 2} className={`shrink-0 ${isAct ? 'text-white' : 'text-gray-400'}`} />
                                                                        )}
                                                                        <span className="text-[8.5px] font-medium uppercase tracking-tight leading-tight">{item.label}</span>
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
                                                                    className={`flex flex-col items-center w-[76px] h-[74px] transition-all group relative
                                                                        ${activeTabId === item.id
                                                                            ? 'bg-white shadow-sm ring-1 ring-gray-200'
                                                                            : 'border-2 border-transparent hover:bg-white/60'}
                                                                    `}
                                                                >
                                                                    <div className="flex items-center justify-center w-full pt-2 pb-0.5 shrink-0">
                                                                        {renderIcon(item, 32)}
                                                                    </div>
                                                                    <div className="flex items-center justify-center w-full px-1 flex-1 min-h-[30px] pb-1">
                                                                        <span className={`text-[6.8px] font-medium text-center leading-[1] uppercase w-full ${activeTabId === item.id ? 'text-[#106ebe]' : 'text-gray-500 group-hover:text-gray-700'
                                                                            }`}>
                                                                            {item.label}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-[8px] font-semibold uppercase text-gray-400 tracking-[0.2em]">{name}</div>
                                            </div>
                                            {idx < Object.entries(sections).length - 1 && (
                                                <div className="w-[1px] self-stretch bg-gray-400/30 mx-1.5 -my-1" />
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
                    <div className="bg-[#e6e6e6] border-b border-gray-300 flex items-center h-9 px-2 gap-px shrink-0 overflow-x-auto scrollbar-hide shadow-inner">
                        {openTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                className={`flex items-center gap-2 px-4 h-full text-[10.5px] font-medium transition-all group min-w-[150px] border-r border-gray-300 ${activeTabId === tab.id
                                    ? 'bg-white text-[#106ebe] z-10'
                                    : 'bg-[#dcdcdc] text-gray-500 hover:bg-[#d0d0d0]'
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
                                                    <h2 className="text-[22px] font-semibold text-slate-800 leading-tight tracking-tight">PORTAL<br />ADMINISTRATIVO</h2>
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
                                                            <span className="text-[11px] font-semibold text-slate-700 uppercase leading-none tracking-tight">
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
                                                        <h2 className="text-[18px] font-semibold text-slate-800 uppercase tracking-tight">
                                                            {MENU_STRUCTURE.find(g => g.id === activeMobileGroup)?.label}
                                                        </h2>
                                                        <span className="text-[10px] font-medium text-[#4f46e5] uppercase tracking-widest leading-none">SELECCIONE MÓDULO</span>
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
                                                                    {iconTheme === 'premium' && item.iconify ? (
                                                                        <PremiumIcon icon={item.iconify} size={28} />
                                                                    ) : (
                                                                        <IC size={24} />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="text-[13px] font-medium text-slate-800 uppercase leading-none mb-1">{item.label}</h4>
                                                                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{item.section || 'Módulo'}</span>
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
                                        <p className="text-xs font-medium uppercase tracking-widest">Seleccione un módulo para comenzar</p>
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
