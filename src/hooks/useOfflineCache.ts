import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { clearStore, putManyInStore } from '@/lib/offlineDb';

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

        const [productsRes, categoriesRes, salesRes, saleItemsRes] = await Promise.all([
          supabase
            .from('products')
            .select('id, business_id, name, sale_price, cost_price, status, category_id, image_url')
            .eq('business_id', businessId)
            .neq('status', 'discontinued'),
          supabase
            .from('categories')
            .select('id, business_id, name')
            .eq('business_id', businessId),
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

        if (productsRes.data) {
          await clearStore('products');
          await putManyInStore('products', productsRes.data);
        }
        if (categoriesRes.data) {
          await clearStore('categories');
          await putManyInStore('categories', categoriesRes.data);
        }
        if (salesRes.data) {
          await clearStore('sales');
          await putManyInStore('sales', salesRes.data);
        }
        if (saleItemsRes.data) {
          await clearStore('sale_items');
          await putManyInStore('sale_items', saleItemsRes.data);
        }

        localStorage.setItem(`bivoo-last-sync-${user.id}`, new Date().toISOString());
        console.log('[useOfflineCache] Datos offline listos');
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
