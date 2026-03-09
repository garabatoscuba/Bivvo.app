import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from './useResolvedBusinessId';
import { useToast } from './use-toast';

export const useEmployeeMaterialStock = () => {
  const { businessId, branchId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['employee-material-stock', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('employee_material_stock' as any)
        .select('*, employees(id, full_name)')
        .eq('business_id', businessId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!businessId,
  });
};

export const useMyMaterialStock = (userId?: string) => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['my-material-stock', businessId, userId],
    queryFn: async () => {
      if (!businessId || !userId) return [];
      // Find employee by auth_user_id
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('business_id', businessId)
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (!emp) return [];
      const { data, error } = await supabase
        .from('employee_material_stock' as any)
        .select('*')
        .eq('employee_id', emp.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!businessId && !!userId,
  });
};

export const useTransferToEmployee = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: { material_id: string; cantidad: number; employee_id: string; from_user_id: string; nota?: string }) => {
      if (!businessId) throw new Error('Sin contexto');
      // Deduct from almacen
      const { data: mat } = await supabase
        .from('raw_materials')
        .select('stock_almacen')
        .eq('id', values.material_id)
        .single();
      if (!mat || mat.stock_almacen < values.cantidad) throw new Error('Stock insuficiente en almacén');

      await supabase.from('raw_materials').update({
        stock_almacen: mat.stock_almacen - values.cantidad,
      }).eq('id', values.material_id);

      // Upsert employee stock
      const { data: existing } = await supabase
        .from('employee_material_stock' as any)
        .select('id, stock')
        .eq('employee_id', values.employee_id)
        .eq('material_id', values.material_id)
        .maybeSingle();

      if (existing) {
        await supabase.from('employee_material_stock' as any)
          .update({ stock: (existing as any).stock + values.cantidad, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
      } else {
        await supabase.from('employee_material_stock' as any).insert({
          business_id: businessId,
          branch_id: branchId,
          employee_id: values.employee_id,
          material_id: values.material_id,
          stock: values.cantidad,
        });
      }

      // Also record transfer
      const { data: emp } = await supabase
        .from('employees')
        .select('auth_user_id')
        .eq('id', values.employee_id)
        .single();

      await supabase.from('raw_material_transfers').insert({
        material_id: values.material_id,
        cantidad: values.cantidad,
        from_user_id: values.from_user_id,
        to_user_id: emp?.auth_user_id || values.employee_id,
        nota: values.nota || null,
        business_id: businessId,
        branch_id: branchId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      qc.invalidateQueries({ queryKey: ['employee-material-stock'] });
      qc.invalidateQueries({ queryKey: ['my-material-stock'] });
      toast({ title: 'Entrega registrada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
