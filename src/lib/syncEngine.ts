import { supabase } from '@/integrations/supabase/client';
import {
  clearStore,
  putManyInStore,
  getPendingOperations,
  removePendingOperation,
  markOperationFailed,
  setSyncMeta,
  getSyncMeta,
  type PendingOperation,
} from './offlineDb';

export const SYNC_MANDATORY_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48h
export const SYNC_WARNING_INTERVAL_MS = 36 * 60 * 60 * 1000; // 36h

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

export async function isSyncWarning(): Promise<boolean> {
  const lastSync = await getSyncMeta('lastSyncTimestamp');
  if (!lastSync) return true;
  return Date.now() - lastSync > SYNC_WARNING_INTERVAL_MS;
}

export async function getLastSyncTime(): Promise<number | null> {
  return getSyncMeta('lastSyncTimestamp');
}

export interface PushResult {
  success: boolean;
  pushed: number;
  failed: number;
}

/**
 * Push all pending operations to cloud. Resilient: skips failed ops.
 */
export async function pushPendingOperations(): Promise<PushResult> {
  const ops = await getPendingOperations();
  if (ops.length === 0) return { success: true, pushed: 0, failed: 0 };

  let pushed = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      await executePendingOperation(op);
      await removePendingOperation(op.id);
      pushed++;
    } catch (err: any) {
      console.error('[SyncEngine] Op failed, marking:', op.table, op.operation, err?.message);
      await markOperationFailed(op.id, err?.message || 'Unknown error');
      failed++;
    }
  }

  return { success: failed === 0, pushed, failed };
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
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = todayStr + 'T00:00:00';
  const endOfDay = todayStr + 'T23:59:59';

  const [
    productsRes,
    categoriesRes,
    branchStockRes,
    branchesRes,
    customersRes,
  ] = await Promise.all([
    supabase.from('products').select('*, category:categories(*)').eq('business_id', businessId).order('name'),
    supabase.from('categories').select('*').eq('business_id', businessId).order('name'),
    supabase.from('branch_stock').select('*').eq('branch_id', branchId),
    supabase.from('branches').select('*').eq('business_id', businessId),
    supabase.from('customers').select('*').eq('business_id', businessId),
  ]);

  const [salesRes, saleItemsRes] = await Promise.all([
    supabase.from('sales').select('*, customers(name)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(500),
    supabase.from('sale_items').select('*, products(name, code)').limit(1000),
  ]);

  const [employeesRes, jornadasRes, rawMaterialsRes, insumoAreasRes, empInsumoAreasRes] = await Promise.all([
    supabase.from('employees').select('*').eq('business_id', businessId),
    supabase.from('jornadas').select('*').eq('sucursal_id', branchId).order('apertura_at', { ascending: false }).limit(100),
    supabase.from('raw_materials').select('*').eq('business_id', businessId),
    supabase.from('insumo_areas').select('*').eq('business_id', businessId),
    supabase.from('employee_insumo_areas').select('*').eq('business_id', businessId),
  ]);

  const recipesRes: { data: any[] | null } = await supabase.from('recipes' as any).select('*').eq('is_active', true);
  const recipeIngredientsRes: { data: any[] | null } = await supabase.from('recipe_ingredients' as any).select('*');
  const serviceCatsRes: { data: any[] | null } = await supabase.from('service_categories' as any).select('*').eq('branch_id', branchId);
  const cashRegistersRes: { data: any[] | null } = await supabase.from('cash_registers' as any).select('*').eq('branch_id', branchId).order('opened_at', { ascending: false }).limit(50);
  const tipConfigRes: { data: any[] | null } = await supabase.from('tip_config' as any).select('*').eq('business_id', businessId);
  const serviceEntriesRes: { data: any[] | null } = await supabase.from('service_entries' as any).select('*').eq('branch_id', branchId).gte('created_at', startOfDay).lte('created_at', endOfDay);

  const tasks: Promise<void>[] = [];
  const cacheIfData = (storeName: string, data: any[] | null) => {
    if (data) {
      tasks.push(clearStore(storeName).then(() => putManyInStore(storeName, data)));
    }
  };

  cacheIfData('products', productsRes.data);
  cacheIfData('categories', categoriesRes.data);
  cacheIfData('branch_stock', branchStockRes.data);
  cacheIfData('branches', branchesRes.data);
  cacheIfData('customers', customersRes.data);
  cacheIfData('sales', salesRes.data);
  cacheIfData('sale_items', saleItemsRes.data);
  cacheIfData('employees', employeesRes.data);
  cacheIfData('jornadas', jornadasRes.data);
  cacheIfData('raw_materials', rawMaterialsRes.data);
  cacheIfData('insumo_areas', insumoAreasRes.data);
  cacheIfData('employee_insumo_areas', empInsumoAreasRes.data);
  cacheIfData('recipes', recipesRes.data);
  cacheIfData('recipe_ingredients', recipeIngredientsRes.data);
  cacheIfData('service_categories', serviceCatsRes.data);
  cacheIfData('cash_registers', cashRegistersRes.data);
  cacheIfData('tip_config', tipConfigRes.data);
  cacheIfData('service_entries', serviceEntriesRes.data);
  cacheIfData('profiles', profilesRes.data);
  cacheIfData('user_roles', userRolesRes.data);

  await Promise.all(tasks);
  await setSyncMeta('lastSyncTimestamp', Date.now());
  await setSyncMeta('lastSyncBranch', branchId);
  await setSyncMeta('lastSyncBusiness', businessId);
}

/**
 * Full sync cycle: push local changes, then pull fresh data.
 */
export async function fullSync(businessId: string, branchId: string): Promise<{ success: boolean; pushed: number; failed: number; error?: string }> {
  try {
    const pushResult = await pushPendingOperations();

    await pullCloudData(businessId, branchId);

    return { success: true, pushed: pushResult.pushed, failed: pushResult.failed };
  } catch (err: any) {
    console.error('Full sync error:', err);
    return { success: false, pushed: 0, failed: 0, error: err.message };
  }
}
