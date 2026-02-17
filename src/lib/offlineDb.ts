import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface PendingOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'rpc';
  data: any;
  timestamp: number;
  branchId?: string;
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

  dbInstance = await openDB<OfflineDBSchema>('sync-sales-offline', 2, {
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
    },
  });

  return dbInstance;
}

// Generic CRUD helpers
export async function getAllFromStore<T>(storeName: keyof Omit<OfflineDBSchema, 'sync_meta' | 'pending_operations'>, indexName?: string, indexValue?: string): Promise<T[]> {
  const db = await getDb();
  if (indexName && indexValue) {
    return db.getAllFromIndex(storeName as any, indexName, indexValue) as Promise<T[]>;
  }
  return db.getAll(storeName as any) as Promise<T[]>;
}

export async function getFromStore<T>(storeName: keyof Omit<OfflineDBSchema, 'sync_meta' | 'pending_operations'>, key: string): Promise<T | undefined> {
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

// Pending operations
export async function addPendingOperation(op: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.put('pending_operations', {
    ...op,
    id,
    timestamp: Date.now(),
  });
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDb();
  return db.getAllFromIndex('pending_operations', 'by-timestamp');
}

export async function removePendingOperation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('pending_operations', id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count('pending_operations');
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
