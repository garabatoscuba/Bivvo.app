import { supabase } from '@/integrations/supabase/client';
import {
  clearStore,
  putManyInStore,
  getPendingOperations,
  removePendingOperation,
  setSyncMeta,
  getSyncMeta,
  type PendingOperation,
} from './offlineDb';

const SYNC_MANDATORY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function isSyncRequired(): Promise<boolean> {
  const lastSync = await getSyncMeta('lastSyncTimestamp');
  if (!lastSync) return true;
  return Date.now() - lastSync > SYNC_MANDATORY_INTERVAL_MS;
}

export async function getLastSyncTime(): Promise<number | null> {
  return getSyncMeta('lastSyncTimestamp');
}

/**
 * Push all pending operations to cloud.
 * Each operation is processed in order; if one fails we stop and return false.
 */
export async function pushPendingOperations(): Promise<{ success: boolean; pushed: number; failed?: PendingOperation }> {
  const ops = await getPendingOperations();
  if (ops.length === 0) return { success: true, pushed: 0 };

  let pushed = 0;

  for (const op of ops) {
    try {
      await executePendingOperation(op);
      await removePendingOperation(op.id);
      pushed++;
    } catch (err) {
      console.error('Sync failed for operation:', op, err);
      return { success: false, pushed, failed: op };
    }
  }

  return { success: true, pushed };
}

async function executePendingOperation(op: PendingOperation): Promise<void> {
  switch (op.operation) {
    case 'insert': {
      const { error } = await supabase.from(op.table as any).insert(op.data);
      if (error) throw error;
      break;
    }
    case 'update': {
      const { id, ...rest } = op.data;
      const { error } = await supabase.from(op.table as any).update(rest).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await supabase.from(op.table as any).delete().eq('id', op.data.id);
      if (error) throw error;
      break;
    }
    case 'rpc': {
      const { functionName, args } = op.data;
      const { error } = await supabase.rpc(functionName, args);
      if (error) throw error;
      break;
    }
  }
}

/**
 * Pull all cloud data for the user's business and branch into IndexedDB.
 */
export async function pullCloudData(businessId: string, branchId: string): Promise<void> {
  // Fetch all data in parallel
  const [
    productsRes,
    categoriesRes,
    branchStockRes,
    branchesRes,
    customersRes,
    salesRes,
    saleItemsRes,
  ] = await Promise.all([
    supabase.from('products').select('*, category:categories(*)').eq('business_id', businessId).order('name'),
    supabase.from('categories').select('*').eq('business_id', businessId).order('name'),
    supabase.from('branch_stock').select('*').eq('branch_id', branchId),
    supabase.from('branches').select('*').eq('business_id', businessId),
    supabase.from('customers').select('*').eq('business_id', businessId),
    supabase.from('sales').select('*, customers(name)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(500),
    // Sale items: we'll fetch for recent sales
    supabase.from('sale_items').select('*, products(name, code)').limit(1000),
  ]);

  // Clear and replace stores
  const tasks: Promise<void>[] = [];

  if (productsRes.data) {
    tasks.push(clearStore('products').then(() => putManyInStore('products', productsRes.data!)));
  }
  if (categoriesRes.data) {
    tasks.push(clearStore('categories').then(() => putManyInStore('categories', categoriesRes.data!)));
  }
  if (branchStockRes.data) {
    tasks.push(clearStore('branch_stock').then(() => putManyInStore('branch_stock', branchStockRes.data!)));
  }
  if (branchesRes.data) {
    tasks.push(clearStore('branches').then(() => putManyInStore('branches', branchesRes.data!)));
  }
  if (customersRes.data) {
    tasks.push(clearStore('customers').then(() => putManyInStore('customers', customersRes.data!)));
  }
  if (salesRes.data) {
    tasks.push(clearStore('sales').then(() => putManyInStore('sales', salesRes.data!)));
  }
  if (saleItemsRes.data) {
    tasks.push(clearStore('sale_items').then(() => putManyInStore('sale_items', saleItemsRes.data!)));
  }

  await Promise.all(tasks);
  await setSyncMeta('lastSyncTimestamp', Date.now());
  await setSyncMeta('lastSyncBranch', branchId);
  await setSyncMeta('lastSyncBusiness', businessId);
}

/**
 * Full sync cycle: push local changes, then pull fresh data.
 */
export async function fullSync(businessId: string, branchId: string): Promise<{ success: boolean; pushed: number; error?: string }> {
  try {
    // 1. Push pending operations first (device wins)
    const pushResult = await pushPendingOperations();
    if (!pushResult.success) {
      return { success: false, pushed: pushResult.pushed, error: 'Error al subir datos locales' };
    }

    // 2. Pull fresh data from cloud
    await pullCloudData(businessId, branchId);

    return { success: true, pushed: pushResult.pushed };
  } catch (err: any) {
    console.error('Full sync error:', err);
    return { success: false, pushed: 0, error: err.message };
  }
}
