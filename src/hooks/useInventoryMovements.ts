import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface InventoryMovementRecord {
  id: string;
  branch_id: string;
  product_id: string;
  user_id: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  reference_id: string | null;
  created_at: string;
  product: { name: string; code: string; unit_of_measure?: string } | null;
  user_profile: { full_name: string } | null;
  branch: { name: string } | null;
}

export const useInventoryMovements = (branchId?: string) => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['inventory-movements', branchId],
    queryFn: async () => {
      if (!branchId) return [];

      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch related data in parallel
      const productIds = [...new Set(data.map(m => m.product_id))];
      const userIds = [...new Set(data.map(m => m.user_id))];

      const [productsRes, rawMaterialsRes, profilesRes, branchRes] = await Promise.all([
        supabase.from('products').select('id, name, code, unit_of_measure').in('id', productIds),
        supabase.from('raw_materials').select('id, name, unit_of_measure').in('id', productIds),
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('branches').select('id, name').eq('id', branchId).single(),
      ]);

      const productMap = new Map(productsRes.data?.map(p => [p.id, p]) || []);
      // Merge raw materials into product map (for items not found in products)
      rawMaterialsRes.data?.forEach(rm => {
        if (!productMap.has(rm.id)) {
          productMap.set(rm.id, { id: rm.id, name: rm.name, code: '' });
        }
      });
      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      return data.map(m => ({
        ...m,
        product: productMap.get(m.product_id) || null,
        user_profile: profileMap.get(m.user_id) || null,
        branch: branchRes.data || null,
      })) as InventoryMovementRecord[];
    },
    enabled: !!branchId && !!profile?.business_id,
  });
};
