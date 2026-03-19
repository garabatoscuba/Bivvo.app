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
  is_voided: boolean;
  voided_at: string | null;
  void_reason: string | null;
  unit_cost: number | null;
  source: 'inventory_movement' | 'raw_material_entry';
  product: { name: string; code: string; unit_of_measure?: string | null } | null;
  user_profile: { full_name: string } | null;
  branch: { name: string } | null;
}

export const useInventoryMovements = (branchId?: string) => {
  const { profile } = useAuth();
  const businessId = profile?.business_id;

  return useQuery({
    queryKey: ['inventory-movements', branchId, businessId],
    queryFn: async () => {
      if (!branchId || !businessId) return [];

      // Fetch inventory_movements and raw_material_entries in parallel
      const [movementsRes, rawEntriesRes] = await Promise.all([
        supabase
          .from('inventory_movements')
          .select('*')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('raw_material_entries')
          .select('id, material_id, cantidad, costo_unitario, entry_type, created_at, nota, purchase_unit, is_voided, voided_at, void_reason, user_id, branch_id')
          .eq('business_id', businessId)
          .gt('cantidad', 0)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (movementsRes.error) throw movementsRes.error;

      const movData = movementsRes.data || [];
      const rawData = rawEntriesRes.data || [];

      // Collect all product/material IDs and user IDs
      const productIdsFromMov = movData.map(m => m.product_id);
      const materialIdsFromRaw = rawData.map(r => (r as any).material_id as string);
      const allProductIds = [...new Set([...productIdsFromMov, ...materialIdsFromRaw])];
      const allUserIds = [...new Set([
        ...movData.map(m => m.user_id),
        ...rawData.map(r => (r as any).user_id as string).filter(Boolean),
      ])];

      // Fetch related data in parallel
      const [productsRes, rawMaterialsRes, profilesRes, branchRes] = await Promise.all([
        supabase.from('products').select('id, name, code, unit_of_measure').in('id', allProductIds.length ? allProductIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('raw_materials').select('id, name, unit_use').in('id', allProductIds.length ? allProductIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('profiles').select('user_id, full_name').in('user_id', allUserIds.length ? allUserIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('branches').select('id, name').eq('id', branchId).single(),
      ]);

      const productMap = new Map(productsRes.data?.map(p => [p.id, p]) || []);
      rawMaterialsRes.data?.forEach(rm => {
        if (!productMap.has(rm.id)) {
          productMap.set(rm.id, { id: rm.id, name: rm.name, code: '', unit_of_measure: rm.unit_use || null });
        }
      });
      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      // Map inventory_movements
      const fromMovements: InventoryMovementRecord[] = movData.map(m => ({
        ...m,
        is_voided: m.is_voided ?? false,
        voided_at: m.voided_at ?? null,
        void_reason: m.void_reason ?? null,
        unit_cost: null,
        source: 'inventory_movement' as const,
        product: productMap.get(m.product_id) || null,
        user_profile: profileMap.get(m.user_id) || null,
        branch: branchRes.data || null,
      }));

      // Map raw_material_entries as purchase movements
      const fromRaw: InventoryMovementRecord[] = rawData.map((r: any) => ({
        id: r.id,
        branch_id: r.branch_id || branchId,
        product_id: r.material_id,
        user_id: r.user_id || '',
        movement_type: 'purchase',
        quantity: r.cantidad,
        notes: r.nota || null,
        reference_id: null,
        created_at: r.created_at,
        is_voided: r.is_voided ?? false,
        voided_at: r.voided_at ?? null,
        void_reason: r.void_reason ?? null,
        unit_cost: r.costo_unitario ?? null,
        source: 'raw_material_entry' as const,
        product: productMap.get(r.material_id) || null,
        user_profile: r.user_id ? (profileMap.get(r.user_id) || null) : null,
        branch: branchRes.data || null,
      }));

      // Merge and sort by date descending
      const merged = [...fromMovements, ...fromRaw];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return merged;
    },
    enabled: !!branchId && !!businessId,
  });
};
