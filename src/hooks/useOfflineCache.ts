import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/offlineDB';
import { toast } from '@/hooks/use-toast';

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

      const toastRef = toast({
        title: 'Sincronizando datos offline...',
        duration: Infinity,
      });

      try {
        const businessId = profile.business_id!;
        const branchId = profile.branch_id!;

        const [productsRes, categoriesRes, servicesRes, cashRes, jornadaRes] = await Promise.all([
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
            .from('services' as any)
            .select('*')
            .eq('business_id', businessId)
            .eq('branch_id', branchId)
            .eq('is_active', true),
          supabase
            .from('cash_registers')
            .select('*')
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('jornadas')
            .select('*')
            .eq('branch_id', branchId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        // Store products
        if (productsRes.data) {
          await db.products.clear();
          const mapped = productsRes.data.map((p: any) => ({
            id: p.id,
            business_id: p.business_id,
            branch_id: branchId,
            name: p.name,
            price: p.sale_price ?? 0,
            stock: 0,
            category_id: p.category_id,
            is_active: p.status !== 'discontinued',
          }));
          if (mapped.length) await db.products.bulkPut(mapped);
        }

        // Store categories
        if (categoriesRes.data) {
          await db.product_categories.clear();
          const mapped = categoriesRes.data.map((c: any) => ({
            id: c.id,
            business_id: c.business_id,
            name: c.name,
          }));
          if (mapped.length) await db.product_categories.bulkPut(mapped);
        }

        // Store services
        if (servicesRes.data && (servicesRes.data as any[]).length) {
          await db.services.clear();
          const mapped = (servicesRes.data as any[]).map((s: any) => ({
            id: s.id,
            business_id: s.business_id ?? businessId,
            branch_id: s.branch_id ?? branchId,
            name: s.name,
            price: s.price ?? 0,
            is_active: s.is_active ?? true,
          }));
          if (mapped.length) await db.services.bulkPut(mapped);
        }

        // Store cash register
        if (cashRes.data && cashRes.data.length) {
          await db.cash_registers.clear();
          const cr = cashRes.data[0];
          await db.cash_registers.put({
            id: cr.id,
            business_id: cr.business_id,
            branch_id: cr.branch_id,
            user_id: cr.user_id,
            status: cr.status,
            opening_amount: cr.opening_amount,
            created_at: cr.created_at,
            synced: true,
          });
        }

        // Store active shift
        if (jornadaRes.data && jornadaRes.data.length) {
          await db.employee_work_sessions.clear();
          const j = jornadaRes.data[0] as any;
          await db.employee_work_sessions.put({
            id: j.id,
            business_id: j.business_id ?? businessId,
            branch_id: j.branch_id ?? branchId,
            user_id: j.user_id ?? user.id,
            status: j.status,
            start_time: j.started_at ?? j.created_at,
            end_time: j.ended_at ?? null,
            synced: true,
          });
        }

        // Save last sync timestamp
        localStorage.setItem(`bivoo-last-sync-${user.id}`, new Date().toISOString());

        toastRef.dismiss?.();
        toast({ title: 'Datos offline listos', duration: 2000 });
      } catch (err) {
        console.error('[useOfflineCache] Error:', err);
        toastRef.dismiss?.();
        toast({ title: 'Error al sincronizar datos offline', variant: 'destructive', duration: 3000 });
      } finally {
        setIsCaching(false);
      }
    };

    run();
  }, [user, profile?.business_id, profile?.branch_id]);

  // Reset flag on logout
  useEffect(() => {
    if (!user) didRunRef.current = false;
  }, [user]);

  return { isCaching };
}
