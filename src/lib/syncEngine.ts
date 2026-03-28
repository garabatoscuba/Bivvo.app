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
  // Batch 1: Core data
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

  // Batch 2: Sales
  const [salesRes, saleItemsRes] = await Promise.all([
    supabase.from('sales').select('*, customers(name)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(500),
    supabase.from('sale_items').select('*, products(name, code)').limit(1000),
  ]);

  // Batch 3: Employees, jornadas, materials
  const [employeesRes, jornadasRes, rawMaterialsRes, insumoAreasRes, empInsumoAreasRes] = await Promise.all([
    supabase.from('employees').select('*').eq('business_id', businessId),
    supabase.from('jornadas').select('*').eq('sucursal_id', branchId).order('apertura_at', { ascending: false }).limit(100),
    supabase.from('raw_materials').select('*').eq('business_id', businessId),
    supabase.from('insumo_areas').select('*').eq('business_id', businessId),
    supabase.from('employee_insumo_areas').select('*').eq('business_id', businessId),
  ]);

  // Batch 4: Recipes, services, cash (sequential to avoid TS2589)
  const recipesRes = await supabase.from('recipes').select('*').eq('is_active', true);
  const recipeIngredientsRes: { data: any[] | null } = await supabase.from('recipe_ingredients' as any).select('*');
  const serviceCatsRes = await supabase.from('service_categories').select('*').eq('branch_id', branchId);
  const cashRegistersRes = await supabase.from('cash_registers').select('*').eq('branch_id', branchId).order('opened_at', { ascending: false }).limit(50);

  // Clear and replace stores
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
