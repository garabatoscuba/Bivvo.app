import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from './useResolvedBusinessId';
import { useToast } from './use-toast';

export const usePrintServiceTypes = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-service-types', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('print_service_types')
        .select('*, raw_materials(name)')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });
};

export const useRawMaterials = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['raw-materials', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*, print_material_types(name, unit)')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });
};

export const usePrintMaterialTypes = () => {
  return useQuery({
    queryKey: ['print-material-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_material_types')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
};

export const usePrintRecipes = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-recipes', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('print_recipes')
        .select('*, print_recipe_materials(id, material_id, cantidad_por_produccion, raw_materials(name))')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });
};

export const useEmployeesForTransfer = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['employees-for-transfer', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, auth_user_id')
        .eq('business_id', businessId)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });
};

// ---- Mutations ----

export const useSaveServiceType = () => {
  const qc = useQueryClient();
  const { businessId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, business_id: businessId };
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('print_service_types').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { error } = await supabase.from('print_service_types').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-service-types'] });
      toast({ title: 'Servicio guardado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteServiceType = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('print_service_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-service-types'] });
      toast({ title: 'Servicio eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useSaveRawMaterial = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, business_id: businessId, branch_id: branchId };
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('raw_materials').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { error } = await supabase.from('raw_materials').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Insumo guardado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useCreateMaterialEntry = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: { material_id: string; cantidad: number; costo_unitario: number; nota?: string; user_id: string }) => {
      // Insert entry
      const { error } = await supabase.from('raw_material_entries').insert({
        ...values,
        business_id: businessId,
        branch_id: branchId,
      });
      if (error) throw error;
      // Update stock + recalculate weighted average cost
      const { data: mat } = await supabase.from('raw_materials').select('stock_almacen').eq('id', values.material_id).single();
      // Fetch all entries to compute weighted average
      const { data: entries } = await supabase
        .from('raw_material_entries')
        .select('cantidad, costo_unitario')
        .eq('material_id', values.material_id);
      let avgCost = values.costo_unitario;
      if (entries && entries.length > 0) {
        const totalValue = entries.reduce((sum: number, e: any) => sum + (e.cantidad * e.costo_unitario), 0);
        const totalQty = entries.reduce((sum: number, e: any) => sum + e.cantidad, 0);
        avgCost = totalQty > 0 ? totalValue / totalQty : 0;
      }
      if (mat) {
        await supabase.from('raw_materials').update({
          stock_almacen: mat.stock_almacen + values.cantidad,
          costo_unitario: avgCost,
        }).eq('id', values.material_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Entrada registrada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useCreateMaterialTransfer = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: { material_id: string; cantidad: number; from_user_id: string; to_user_id: string; nota?: string }) => {
      const { error } = await supabase.from('raw_material_transfers').insert({
        ...values,
        business_id: businessId,
        branch_id: branchId,
      });
      if (error) throw error;
      // Move stock: almacen → vendedor
      const { data: mat } = await supabase.from('raw_materials').select('stock_almacen, stock_vendedor').eq('id', values.material_id).single();
      if (mat) {
        await supabase.from('raw_materials').update({
          stock_almacen: mat.stock_almacen - values.cantidad,
          stock_vendedor: mat.stock_vendedor + values.cantidad,
        }).eq('id', values.material_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Entrega registrada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useSavePrintRecipe = () => {
  const qc = useQueryClient();
  const { businessId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recipe, materials }: { recipe: any; materials: { material_id: string; cantidad_por_produccion: number }[] }) => {
      let recipeId = recipe.id;
      if (recipeId) {
        const { id, ...rest } = recipe;
        const { error } = await supabase.from('print_recipes').update({ ...rest, business_id: businessId }).eq('id', id);
        if (error) throw error;
        // Delete old materials and re-insert
        await supabase.from('print_recipe_materials').delete().eq('recipe_id', recipeId);
      } else {
        const { data, error } = await supabase.from('print_recipes').insert({ ...recipe, business_id: businessId }).select('id').single();
        if (error) throw error;
        recipeId = data.id;
      }
      if (materials.length > 0) {
        const rows = materials.map(m => ({ ...m, recipe_id: recipeId }));
        const { error } = await supabase.from('print_recipe_materials').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-recipes'] });
      toast({ title: 'Receta guardada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

// ---- Active Sheets (hojas activas para tramos) ----

export const useActiveSheets = () => {
  const { businessId, branchId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-active-sheets', businessId, branchId],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const { data, error } = await supabase
        .from('print_active_sheets' as any)
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('status', 'activa');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && !!branchId,
  });
};

export const useSheetHistory = () => {
  const { businessId, branchId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-sheet-history', businessId, branchId],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const { data, error } = await supabase
        .from('print_active_sheets' as any)
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('status', 'agotada')
        .order('closed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && !!branchId,
  });
};

export const useOpenSheet = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ material_id, tramos_total, user_id }: { material_id: string; tramos_total: number; user_id: string }) => {
      if (!businessId || !branchId) throw new Error('Sin contexto');
      // Deduct 1 unit from stock_vendedor
      const { data: mat } = await supabase.from('raw_materials').select('stock_vendedor').eq('id', material_id).single();
      if (!mat || mat.stock_vendedor < 1) throw new Error('Sin stock disponible para abrir hoja');
      await supabase.from('raw_materials').update({ stock_vendedor: mat.stock_vendedor - 1 }).eq('id', material_id);
      // Create active sheet
      const { error } = await supabase.from('print_active_sheets' as any).insert({
        business_id: businessId,
        branch_id: branchId,
        user_id,
        material_id,
        tramos_total,
        tramos_usados: 0,
        status: 'activa',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-active-sheets'] });
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Hoja abierta' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
