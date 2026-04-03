import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface PendingOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'rpc';
  data: any;
  timestamp: number;
  branchId?: string;
  status?: 'pending' | 'failed';
  errorMessage?: string;
}

interface OfflineDBSchema extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  categories: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  branch_stock: {
    key: string;
    value: any;
    indexes: { 'by-branch': string; 'by-product': string };
  };
  branches: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  customers: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  sales: {
    key: string;
    value: any;
    indexes: { 'by-branch': string };
  };
  sale_items: {
    key: string;
    value: any;
    indexes: { 'by-sale': string };
  };
  profiles: {
    key: string;
    value: any;
  };
  user_roles: {
    key: string;
    value: any;
    indexes: { 'by-user': string };
  };
  employees: {
    key: string;
    value: any;
    indexes: { 'by-business': string; 'by-auth-user': string };
  };
  jornadas: {
    key: string;
    value: any;
    indexes: { 'by-employee': string; 'by-branch': string };
  };
  raw_materials: {
    key: string;
    value: any;
    indexes: { 'by-business': string; 'by-area': string };
  };
  insumo_areas: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  employee_insumo_areas: {
    key: string;
    value: any;
    indexes: { 'by-employee': string };
  };
  service_categories: {
    key: string;
    value: any;
    indexes: { 'by-branch': string };
  };
  recipes: {
    key: string;
    value: any;
    indexes: { 'by-product': string };
  };
  recipe_ingredients: {
    key: string;
    value: any;
    indexes: { 'by-recipe': string };
  };
  cash_registers: {
    key: string;
    value: any;
    indexes: { 'by-user': string; 'by-branch': string };
  };
  tip_config: {
    key: string;
    value: any;
    indexes: { 'by-business': string };
  };
  service_entries: {
    key: string;
    value: any;
    indexes: { 'by-branch': string; 'by-business': string };
  };
  pending_operations: {
    key: string;
    value: PendingOperation;
    indexes: { 'by-timestamp': number };
  };
  sync_meta: {
    key: string;
    value: { key: string; value: any };
  };
}

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

export async function getDb(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>('sync-sales-offline', 4, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('by-business', 'business_id');
        const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoriesStore.createIndex('by-business', 'business_id');
        const branchStockStore = db.createObjectStore('branch_stock', { keyPath: 'id' });
        branchStockStore.createIndex('by-branch', 'branch_id');
        branchStockStore.createIndex('by-product', 'product_id');
        const branchesStore = db.createObjectStore('branches', { keyPath: 'id' });
        branchesStore.createIndex('by-business', 'business_id');
        const customersStore = db.createObjectStore('customers', { keyPath: 'id' });
        customersStore.createIndex('by-business', 'business_id');
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('by-branch', 'branch_id');
        const saleItemsStore = db.createObjectStore('sale_items', { keyPath: 'id' });
        saleItemsStore.createIndex('by-sale', 'sale_id');
        db.createObjectStore('profiles', { keyPath: 'id' });
        const userRolesStore = db.createObjectStore('user_roles', { keyPath: 'id' });
        userRolesStore.createIndex('by-user', 'user_id');
        const pendingStore = db.createObjectStore('pending_operations', { keyPath: 'id' });
        pendingStore.createIndex('by-timestamp', 'timestamp');
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('employees')) {
          const employeesStore = db.createObjectStore('employees', { keyPath: 'id' });
          employeesStore.createIndex('by-business', 'business_id');
          employeesStore.createIndex('by-auth-user', 'auth_user_id');
        }
        if (!db.objectStoreNames.contains('jornadas')) {
          const jornadasStore = db.createObjectStore('jornadas', { keyPath: 'id' });
          jornadasStore.createIndex('by-employee', 'empleado_id');
          jornadasStore.createIndex('by-branch', 'sucursal_id');
        }
        if (!db.objectStoreNames.contains('raw_materials')) {
          const rawMaterialsStore = db.createObjectStore('raw_materials', { keyPath: 'id' });
          rawMaterialsStore.createIndex('by-business', 'business_id');
          rawMaterialsStore.createIndex('by-area', 'insumo_area_id');
        }
        if (!db.objectStoreNames.contains('insumo_areas')) {
          const insumoAreasStore = db.createObjectStore('insumo_areas', { keyPath: 'id' });
          insumoAreasStore.createIndex('by-business', 'business_id');
        }
        if (!db.objectStoreNames.contains('employee_insumo_areas')) {
          const empInsumoStore = db.createObjectStore('employee_insumo_areas', { keyPath: 'id' });
          empInsumoStore.createIndex('by-employee', 'employee_id');
        }
        if (!db.objectStoreNames.contains('service_categories')) {
          const svcCatStore = db.createObjectStore('service_categories', { keyPath: 'id' });
          svcCatStore.createIndex('by-branch', 'branch_id');
        }
        if (!db.objectStoreNames.contains('recipes')) {
          const recipesStore = db.createObjectStore('recipes', { keyPath: 'id' });
          recipesStore.createIndex('by-product', 'product_id');
        }
        if (!db.objectStoreNames.contains('recipe_ingredients')) {
          const recipeIngStore = db.createObjectStore('recipe_ingredients', { keyPath: 'id' });
          recipeIngStore.createIndex('by-recipe', 'recipe_id');
        }
        if (!db.objectStoreNames.contains('cash_registers')) {
          const cashRegStore = db.createObjectStore('cash_registers', { keyPath: 'id' });
          cashRegStore.createIndex('by-user', 'user_id');
          cashRegStore.createIndex('by-branch', 'branch_id');
        }
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('tip_config')) {
          const tipStore = db.createObjectStore('tip_config', { keyPath: 'id' });
          tipStore.createIndex('by-business', 'business_id');
        }
        if (!db.objectStoreNames.contains('service_entries')) {
          const seStore = db.createObjectStore('service_entries', { keyPath: 'id' });
          seStore.createIndex('by-branch', 'branch_id');
          seStore.createIndex('by-business', 'business_id');
        }
      }
    },
  });

  return dbInstance;
}

// Generic CRUD helpers
export async function getAllFromStore<T>(storeName: string, indexName?: string, indexValue?: string): Promise<T[]> {
  const db = await getDb();
  if (indexName && indexValue) {
    return db.getAllFromIndex(storeName as any, indexName, indexValue) as Promise<T[]>;
  }
  return db.getAll(storeName as any) as Promise<T[]>;
}

export async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get(storeName as any, key) as Promise<T | undefined>;
}

export async function putInStore(storeName: string, data: any): Promise<void> {
  const db = await getDb();
  await db.put(storeName as any, data);
}

export async function putManyInStore(storeName: string, items: any[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName as any, 'readwrite');
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await getDb();
  await db.delete(storeName as any, key);
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await getDb();
  await db.clear(storeName as any);
}

/**
 * Update a single record in a store by merging changes.
 * Useful for updating local jornada after offline closure.
 */
export async function updateInStore(storeName: string, id: string, changes: Record<string, any>): Promise<void> {
  const db = await getDb();
  const existing = await db.get(storeName as any, id);
  if (existing) {
    const updated = { ...existing, ...changes };
    await db.put(storeName as any, updated);
  }
}

/**
 * Get all records from a store index and apply a JS filter function.
 * Useful for filtered offline queries (e.g. today's sales by branch).
 */
export async function getFilteredFromStore<T>(
  storeName: string,
  indexName: string,
  indexValue: string,
  filterFn?: (item: T) => boolean
): Promise<T[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(storeName as any, indexName, indexValue) as T[];
  return filterFn ? all.filter(filterFn) : all;
}

// Pending operations
export async function addPendingOperation(op: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.put('pending_operations', {
    ...op,
    id,
    timestamp: Date.now(),
    status: 'pending',
  });
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('pending_operations', 'by-timestamp');
  return all.filter(op => !op.status || op.status === 'pending');
}

export async function getFailedOperations(): Promise<PendingOperation[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('pending_operations', 'by-timestamp');
  return all.filter(op => op.status === 'failed');
}

export async function markOperationFailed(id: string, errorMessage: string): Promise<void> {
  const db = await getDb();
  const op = await db.get('pending_operations', id);
  if (op) {
    op.status = 'failed';
    op.errorMessage = errorMessage;
    await db.put('pending_operations', op);
  }
}

export async function retryFailedOperation(id: string): Promise<void> {
  const db = await getDb();
  const op = await db.get('pending_operations', id);
  if (op) {
    op.status = 'pending';
    op.errorMessage = undefined;
    await db.put('pending_operations', op);
  }
}

export async function retryAllFailedOperations(): Promise<void> {
  const failed = await getFailedOperations();
  const db = await getDb();
  const tx = db.transaction('pending_operations', 'readwrite');
  for (const op of failed) {
    op.status = 'pending';
    op.errorMessage = undefined;
    await tx.store.put(op);
  }
  await tx.done;
}

export async function removePendingOperation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('pending_operations', id);
}

export async function getPendingCount(): Promise<number> {
  const ops = await getPendingOperations();
  return ops.length;
}

export async function getFailedCount(): Promise<number> {
  const ops = await getFailedOperations();
  return ops.length;
}

const STORE_NAMES = [
  'products', 'categories', 'branch_stock', 'branches', 'customers',
  'sales', 'sale_items', 'employees', 'jornadas', 'raw_materials',
  'insumo_areas', 'service_categories', 'recipes', 'cash_registers',
  'tip_config', 'service_entries',
] as const;

const STORE_LABELS: Record<string, string> = {
  products: 'Productos',
  categories: 'Categorías',
  branch_stock: 'Stock',
  branches: 'Sucursales',
  customers: 'Clientes',
  sales: 'Ventas',
  sale_items: 'Items de venta',
  employees: 'Empleados',
  jornadas: 'Jornadas',
  raw_materials: 'Insumos',
  insumo_areas: 'Áreas',
  service_categories: 'Servicios',
  recipes: 'Recetas',
  cash_registers: 'Cajas',
  tip_config: 'Config. Propinas',
  service_entries: 'Cobros Servicios',
};

export async function getStoreCounts(): Promise<{ name: string; label: string; count: number }[]> {
  const db = await getDb();
  const results: { name: string; label: string; count: number }[] = [];
  for (const name of STORE_NAMES) {
    try {
      const count = await db.count(name as any);
      results.push({ name, label: STORE_LABELS[name] || name, count });
    } catch {
      results.push({ name, label: STORE_LABELS[name] || name, count: 0 });
    }
  }
  return results;
}

// Sync meta
export async function getSyncMeta(key: string): Promise<any> {
  const db = await getDb();
  const record = await db.get('sync_meta', key);
  return record?.value;
}

export async function setSyncMeta(key: string, value: any): Promise<void> {
  const db = await getDb();
  await db.put('sync_meta', { key, value });
}
