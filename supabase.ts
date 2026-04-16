
// This file defines the structure for Supabase integration
// You can replace the mock calls with actual supabase client calls


import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '') || '';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '') || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    timeout: 20000,
    heartbeatIntervalMs: 10000, // Balanced value: responsive but not flooding
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});


export interface Profile {
  id: string;
  full_name: string;
  role: 'ADMIN' | 'CAJERO' | 'MESERO' | 'COCINA';
  role_id?: string;
  pin: string;
}

export interface Table {
  id: string;
  number: number;
  section: string;
  status: 'available' | 'occupied' | 'reserved';
  capacity: number;
  is_locked?: boolean;
  current_order_id?: string;
}

export interface Category {
  id: string;
  name: string;
  icon_name: string;
  order_index: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

export interface Order {
  id: string;
  table_id: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  waiter_id: string;
  created_at: string;
  cash_amount?: number;
  card_amount?: number;
  credit_amount?: number;
  other_amount?: number;
  total_paid?: number;
  change_amount?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  status?: 'pending' | 'preparing' | 'ready' | 'delivered' | 'voided';
  void_reason?: string;
  voided_at?: string;
}
