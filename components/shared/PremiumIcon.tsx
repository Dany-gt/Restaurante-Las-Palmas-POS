import React from 'react';
import { Icon } from '@iconify/react';

interface PremiumIconProps {
  icon: string;
  size?: number | string;
  className?: string;
  color?: string;
}

/**
 * Mapeo de iconos para el POS Las Palmas
 * Basado en la estética "Flat Business" de Páladar
 */
export const ICON_MAP = {
  // Módulos Principales
  // Módulos Principales
  TABLES: 'flat-color-icons:grid',
  QUICK: 'flat-color-icons:flash-on',
  TAKEOUT: 'flat-color-icons:shop',
  DELIVERY: 'flat-color-icons:shipped',
  
  // Administración
  ADMIN_SYS: 'flat-color-icons:settings',
  ADMIN_CONFIG: 'flat-color-icons:data-configuration',
  ADMIN_DISHES: 'flat-color-icons:template',
  ADMIN_INV: 'flat-color-icons:package',
  ADMIN_REP: 'flat-color-icons:filing-cabinet',
  ADMIN_DASH: 'flat-color-icons:sales-performance',
  
  // Dashboards Específicos
  DASH_CASH: 'flat-color-icons:safe',
  DASH_INVOICE: 'flat-color-icons:survey',
  DASH_SALES: 'flat-color-icons:positive-dynamic',
  DASH_DISHES: 'flat-color-icons:rating',
  DASH_EXPENSES: 'flat-color-icons:negative-dynamic',

  // Estrategia
  STRAT_MENU: 'flat-color-icons:reading',
  STRAT_COSTS: 'flat-color-icons:calculator',
  STRAT_FINANCE: 'flat-color-icons:money-transfer',
  STRAT_KITCHEN: 'flat-color-icons:alarm-clock',
  STRAT_PROD: 'flat-color-icons:factory',

  // Contabilidad
  ACCT_PORTAL: 'flat-color-icons:business-contact',

  // Configuración
  CFG_KITCHEN: 'flat-color-icons:services',
  CFG_CASH: 'flat-color-icons:money-transfer',
  CFG_SECTIONS: 'flat-color-icons:org-unit',
  CFG_PRINTERS: 'flat-color-icons:print',
  CFG_POS: 'flat-color-icons:chip-card',
  CFG_USERS: 'flat-color-icons:conference-call',
  CFG_DISCOUNTS: 'flat-color-icons:sales-performance',
  CFG_PLATFORMS: 'flat-color-icons:globe',
  CFG_DRIVERS: 'flat-color-icons:shipped',
  CFG_RECEIVABLE: 'flat-color-icons:debt',
  CFG_EXPENSES: 'flat-color-icons:currency-exchange',

  // Platillos y Bebidas
  MENU_LIST: 'flat-color-icons:database',
  MENU_PREVIEW: 'flat-color-icons:view-details',
  MENU_MODS: 'flat-color-icons:puzzle',
  MENU_MODS_GRP: 'flat-color-icons:flow-chart',
  MENU_MODS_ASG: 'flat-color-icons:fine-print',
  MENU_OPTS: 'flat-color-icons:list',
  MENU_OPTS_GRP: 'flat-color-icons:workflow',
  MENU_OPTS_ASG: 'flat-color-icons:neutral-trading',

  // Inventarios
  INV_SUPPLIERS: 'flat-color-icons:manager',
  INV_PRODUCTS: 'flat-color-icons:package',
  INV_PURCHASES: 'flat-color-icons:shop',
  INV_LEVELING: 'flat-color-icons:inspection',
  INV_TRANSFER: 'flat-color-icons:parallel-tasks',
  INV_KARDEX: 'flat-color-icons:fine-print',
  INV_PRODUCTION: 'flat-color-icons:factory',
  INV_STOCK_SUC: 'flat-color-icons:home',
  INV_STOCK_REORDER: 'flat-color-icons:timeline',
  INV_STOCK_DATE: 'flat-color-icons:calendar',

  // Reportes
  REP_GENERAL: 'flat-color-icons:advertising',
  REP_ORDERS: 'flat-color-icons:document',
  REP_OPEN: 'flat-color-icons:opened-folder',
  REP_CLOSED: 'flat-color-icons:inspection',
  REP_CLOSED_CH: 'flat-color-icons:flow-chart',
  REP_CREDIT: 'flat-color-icons:neutral-trading',
  REP_VOID: 'flat-color-icons:disclaimer',
  REP_DISC: 'flat-color-icons:sales-performance',
  REP_ALL: 'flat-color-icons:numerical-sorting-12',
  REP_DELIVERY: 'flat-color-icons:shipped',
  REP_SOLD: 'flat-color-icons:doughnut-chart',
  REP_SOLD_GEN: 'flat-color-icons:rating',
  REP_SOLD_USER: 'flat-color-icons:manager',
  REP_CASH: 'flat-color-icons:safe',
  REP_INVOICE: 'flat-color-icons:survey',
  REP_STATS: 'flat-color-icons:statistics',
  REP_CHART_BAR: 'flat-color-icons:bar-chart',
  REP_CHART_LINE: 'flat-color-icons:line-chart',
  REP_CHART_PIE: 'flat-color-icons:pie-chart',

  // Otros
  KITCHEN: 'flat-color-icons:print',
  CASHIER: 'flat-color-icons:display',
  CREDIT_CARD: 'fluent-emoji-flat:credit-card',
  PAID: 'flat-color-icons:paid',
  EXPENSES: 'flat-color-icons:todo-list',
  WAITERS: 'flat-color-icons:assistant',
  LOGOUT: 'flat-color-icons:leave',
  AUTH: 'flat-color-icons:signature',
  SOUNDS: 'flat-color-icons:audio-file',
  SUMINISTROS: 'flat-color-icons:filing-cabinet',
  UTENSILIOS: 'fluent-emoji-flat:cooking',

  // UI Genérica (Premium fallback)
  CLOSE: 'flat-color-icons:cancel',
  SAVE: 'flat-color-icons:ok',
  SEARCH: 'flat-color-icons:search',
  PLUS: 'flat-color-icons:plus',
  TRASH: 'flat-color-icons:delete-database',
  PRINTER: 'flat-color-icons:print',
  CHEF: 'flat-color-icons:assistant',
  FOLDER: 'flat-color-icons:opened-folder',
  CHEVRON_DOWN: 'flat-color-icons:expand',
  IMAGE: 'flat-color-icons:picture',
  SPARKLES: 'flat-color-icons:flash-on',
  REFRESH: 'flat-color-icons:refresh',
  EDIT: 'flat-color-icons:edit-image'
};

export const PremiumIcon: React.FC<PremiumIconProps> = ({ icon, size = 24, className = '', color }) => {
  return (
    <Icon 
      icon={icon} 
      width={size} 
      height={size} 
      className={className}
      style={color ? { color } : undefined}
    />
  );
};
