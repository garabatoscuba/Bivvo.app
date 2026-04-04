import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { clearStore, putManyInStore, setSyncMeta } from '@/lib/offlineDb';

export function useOfflineCache() {
  const { user, profile } = useAuth();
  const [isCaching, setIsCaching] = useState(false);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!user || !profile?.business_id || !profile?.branch_id || !navigator.onLine) return;
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      setIsCaching(true);

      try {
        const businessId = profile.business_id!;
        const branchId = profile.branch_id!;

        // Batch 1: Core data
        const [productsRes, categoriesRes, branchStockRes, branchesRes, customersRes] = await Promise.all([
          supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('business_id', businessId)
            .order('name'),
          supabase
            .from('categories')
            .select('*')
            .eq('business_id', businessId)
            .order('name'),
          supabase
            .from('branch_stock')
            .select('*, product:products(*, category:categories(*))')
            .eq('branch_id', branchId),
          supabase
            .from('branches')
            .select('*')
            .eq('business_id', businessId),
          supabase
            .from('customers')
            .select('*')
            .eq('business_id', businessId),
        ]);

        // Batch 2: Sales data
        const [salesRes, saleItemsRes] = await Promise.all([
          supabase
            .from('sales')
            .select('*, customers(name)')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('sale_items')
            .select('*, products(name, code)')
            .limit(1000),
        ]);

        // Batch 3: Employees, jornadas, insumos
        const [employeesRes, jornadasRes, rawMaterialsRes, insumoAreasRes, empInsumoAreasRes] = await Promise.all([
          supabase
            .from('employees')
            .select('*')
            .eq('business_id', businessId),
          supabase
            .from('jornadas')
            .select('*')
            .eq('sucursal_id', branchId)
            .order('apertura_at', { ascending: false })
            .limit(100),
          supabase
            .from('raw_materials')
            .select('*')
            .eq('business_id', businessId),
          supabase
            .from('insumo_areas')
            .select('*')
            .eq('business_id', businessId),
          supabase
            .from('employee_insumo_areas')
            .select('*')
            .eq('business_id', businessId),
        ]);

        // Batch 4: Recipes, services, cash registers
        const recipesRes: { data: any[] | null } = await supabase.from('recipes' as any).select('*').eq('is_active', true);
        const recipeIngredientsRes: { data: any[] | null } = await supabase.from('recipe_ingredients' as any).select('*');
        const serviceCatsRes: { data: any[] | null } = await supabase.from('service_categories' as any).select('*').eq('branch_id', branchId);
        const cashRegistersRes: { data: any[] | null } = await supabase.from('cash_registers' as any).select('*').eq('branch_id', branchId).order('opened_at', { ascending: false }).limit(50);

        // Batch 5: Auth data for offline login
        const profilesRes = await supabase.from('profiles').select('*').eq('business_id', businessId);
        const profileUserIds = (profilesRes.data || []).map((p: any) => p.user_id).filter(Boolean);
        let userRolesRes: { data: any[] | null } = { data: [] };
        if (profileUserIds.length > 0) {
          userRolesRes = await supabase.from('user_roles').select('*').in('user_id', profileUserIds);
        }

        // Write all to IndexedDB
        const writes: Promise<void>[] = [];

        const cacheIfData = (storeName: string, data: any[] | null) => {
          if (data && data.length > 0) {
            writes.push(clearStore(storeName).then(() => putManyInStore(storeName, data)));
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
        cacheIfData('profiles', profilesRes.data);
        cacheIfData('user_roles', userRolesRes.data);

        await Promise.all(writes);

        // Mark sync as completed in IndexedDB so SyncGate won't block offline
        await setSyncMeta('lastSyncTimestamp', Date.now());
        await setSyncMeta('lastSyncBusiness', businessId);
        await setSyncMeta('lastSyncBranch', branchId);

        localStorage.setItem(`bivoo-last-sync-${user.id}`, new Date().toISOString());
        console.log('[useOfflineCache] Datos offline listos — todos los stores actualizados');
      } catch (err) {
        console.error('[useOfflineCache] Error:', err);
      } finally {
        setIsCaching(false);
      }
    };

    run();
  }, [user, profile?.business_id, profile?.branch_id]);

  useEffect(() => {
    if (!user) didRunRef.current = false;
  }, [user]);

  return { isCaching };
}
