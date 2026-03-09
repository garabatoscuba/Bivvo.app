import Dexie from 'dexie/dist/dexie.mjs';

type Table<T = any, TKey = any> = any;

const DexieAny: any = Dexie;

export interface OfflineProduct {
  id: string;
  business_id: string;
  branch_id: string;
  name: string;
  price: number;
  stock: number;
  category_id: string | null;
  is_active: boolean;
}

export interface OfflineProductCategory {
  id: string;
  business_id: string;
  name: string;
}

export interface OfflineService {
  id: string;
  business_id: string;
  branch_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface OfflineSale {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  total: number;
  payment_method: string;
  created_at: string;
  synced: boolean;
}

export interface OfflineSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  synced: boolean;
}

export interface OfflineCashRegister {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  status: string;
  opening_amount: number;
  created_at: string;
  synced: boolean;
}

export interface OfflineCashRegisterMovement {
  id: string;
  cash_register_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  synced: boolean;
}

export interface OfflineEmployeeWorkSession {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  status: string;
  start_time: string;
  end_time: string | null;
  synced: boolean;
}

export interface PendingSyncRecord {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  created_at: string;
}

class BivooDB extends DexieAny {
  products!: Table<OfflineProduct, string>;
  product_categories!: Table<OfflineProductCategory, string>;
  services!: Table<OfflineService, string>;
  sales!: Table<OfflineSale, string>;
  sale_items!: Table<OfflineSaleItem, string>;
  cash_registers!: Table<OfflineCashRegister, string>;
  cash_register_movements!: Table<OfflineCashRegisterMovement, string>;
  employee_work_sessions!: Table<OfflineEmployeeWorkSession, string>;
  pending_sync!: Table<PendingSyncRecord, string>;

  constructor() {
    super('BivooDB');

    this.version(1).stores({
      products: 'id, business_id, branch_id, name, price, stock, category_id, is_active',
      product_categories: 'id, business_id, name',
      services: 'id, business_id, branch_id, name, price, is_active',
      sales: 'id, business_id, branch_id, user_id, total, payment_method, created_at, synced',
      sale_items: 'id, sale_id, product_id, quantity, unit_price, synced',
      cash_registers: 'id, business_id, branch_id, user_id, status, opening_amount, created_at, synced',
      cash_register_movements: 'id, cash_register_id, type, amount, description, created_at, synced',
      employee_work_sessions: 'id, business_id, branch_id, user_id, status, start_time, end_time, synced',
      pending_sync: 'id, table_name, record_id, operation, created_at',
    });
  }
}

export const db: any = new BivooDB();
