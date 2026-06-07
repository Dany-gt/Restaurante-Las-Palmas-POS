export type UserRole = 'ADMIN' | 'CAJERO' | 'MESERO' | 'COCINA' | 'PRODUCCION' | 'REPARTIDOR' | 'SUPER_ADMIN';

export interface Branch {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  is_main?: boolean;
  created_at?: string;
  org_id?: string; // Multi-tenant isolation
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  originalRole?: UserRole;
  role_id?: string;
  permissions?: string[];
  branch_id?: string; // Optional if global admin
  org_id?: string;    // Multi-tenant isolation
  is_superadmin?: boolean;
}

export interface Table {
  id: string;
  number: number;
  section: string;
  status: 'available' | 'occupied' | 'reserved' | 'deleted';
  capacity: number;
  qr_code?: string;
  locked_by?: string | null;
  locked_at?: string | null;
  branch_id: string; // Multi-branch isolation
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  parent_id?: string;
  image_url?: string;
  priority?: number;
  is_enabled?: boolean;
  branch_id?: string;
  section?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url?: string;
  description?: string;
  is_enabled?: boolean;
  priority?: number;
  kitchen_station_id?: string;
  inventory_item_id?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  unit_measure?: string;
  classification?: string;
  portions?: number;
  portion_size?: string;
  serving_temp?: string;
  prep_time?: string;
  prepared_by?: string;
  prep_procedure?: string;
  observations?: string;
  branch_id: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  is_sent?: boolean;
  notes?: string;
  status?: string;
  preparing_at?: string;
  ready_at?: string;
  discount_percentage?: number;
  discount_amount?: number;
  discount_type?: 'PERCENT' | 'AMOUNT';
  discount_id?: string;
  discount_reason?: string;
  created_at?: string;
  order_id?: string;
}

export interface Order {
  id: string;
  table_id?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'preparing' | 'ready' | 'delivering';
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  waiter_id: string;
  waiter?: { name: string };
  created_at: string;
  dispatched_at?: string;
  order_type?: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  pax_count?: number;
  customer_id?: string;
  order_number?: number;
  platform_id?: string;
  is_platform_driver?: boolean;
  requires_printing?: boolean;
  print_status?: 'pending' | 'printed' | 'failed';
  branch_id: string; // The key for isolation
  cashier_id?: string;
}

export interface Shift {
  id: string;
  cash_register_id: string;
  cashier_id: string;
  start_time: string;
  end_time?: string;
  start_amount: number;
  end_amount?: number;
  counted_amount?: number;
  difference_amount?: number;
  status: 'OPEN' | 'CLOSED';
  blind_cut?: boolean;
  cash_detail?: any;
  branch_id: string;
}

export interface POSTerminal {
  id: string;
  name: string;
  serial: string;
  status: 'online' | 'offline';
  type: 'Físico' | 'Virtual';
  logo_url?: string;
  created_at?: string;
  branch_id: string; // Multi-branch isolation
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  phone2?: string;
  nit?: string;
  email?: string;
  address?: string; // Dirección principal legacy
  notes?: string;
  reference?: string;
  city?: string;
  coordinates?: string;
  credit_limit: number;
  current_balance: number;
  authorized_discount: number;
  is_active?: boolean;
  addresses?: CustomerAddress[];
  branch_id?: string; // Multi-branch isolation
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  name: string;
  address: string;
  reference?: string;
  city?: string;
  zone?: string;
  coordinates?: string;
  is_default: boolean;
}

export interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_role: string;
  branch_id?: string;
  org_id?: string;
  module: string;
  action: string;
  details: any;
}
