import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from './useResolvedBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

interface RegisterShrinkageParams {
  material_id: string;
  cantidad: number;
  motivo: string;
  nota?: string;
  costo_unitario?: number;
}

export const useRegisterPrintShrinkage = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: RegisterShrinkageParams) => {
      if (!businessId || !branchId || !profile?.user_id) {
        throw new Error('Contexto incompleto');
      }

      // 1. Get material info to calculate valor_perdido
      const { data: material, error: matError } = await supabase
        .from('raw_materials')
        .select('costo_unitario')
        .eq('id', params.material_id)
        .single();

      if (matError) throw matError;

      const valor_perdido = params.cantidad * (material?.costo_unitario || 0);

      // 2. Get employee's merma_descuento_pct
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, merma_descuento_pct, full_name')
        .eq('auth_user_id', profile.user_id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (empError) throw empError;

      const descuento_pct = employee?.merma_descuento_pct || 0;
      const monto_descuento = valor_perdido * (descuento_pct / 100);

      // 3. Insert shrinkage record
      const { data: shrinkage, error: shrinkError } = await supabase
        .from('print_shrinkage')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          user_id: profile.user_id,
          material_id: params.material_id,
          cantidad: params.cantidad,
          motivo: params.motivo,
          nota: params.nota,
          valor_perdido,
          monto_descuento,
          estado: 'pendiente',
        })
        .select('id, material_id')
        .single();

      if (shrinkError) throw shrinkError;

      // 4. Update material stock
      const { data: mat } = await supabase
        .from('raw_materials')
        .select('stock_almacen, stock_vendedor')
        .eq('id', params.material_id)
        .single();

      if (mat) {
        // Deduct from stock_vendedor first, then stock_almacen if needed
        let remaining = params.cantidad;
        let new_vendedor = mat.stock_vendedor;
        let new_almacen = mat.stock_almacen;

        if (new_vendedor >= remaining) {
          new_vendedor -= remaining;
        } else {
          remaining -= new_vendedor;
          new_vendedor = 0;
          new_almacen = Math.max(0, new_almacen - remaining);
        }

        await supabase
          .from('raw_materials')
          .update({
            stock_vendedor: new_vendedor,
            stock_almacen: new_almacen,
          })
          .eq('id', params.material_id);
      }

      // 5. Get material name for notification
      const { data: matData } = await supabase
        .from('raw_materials')
        .select('name')
        .eq('id', params.material_id)
        .single();

      // 6. Get business owner(s) to notify
      const { data: owners } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'owner');

      if (owners && owners.length > 0) {
        // Get business_id for each owner and filter for current business
        for (const owner of owners) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('business_id')
            .eq('user_id', owner.user_id)
            .single();

          if (ownerProfile?.business_id === businessId) {
            // Create notification for owner
            await supabase.from('notifications').insert({
              business_id: businessId,
              branch_id: branchId,
              user_id: owner.user_id,
              type: 'shrinkage_pending',
              title: 'Merma registrada',
              message: `${employee?.full_name || 'Un empleado'} registró una merma de ${params.cantidad} ${matData?.name || 'unidades'} por valor de $${valor_perdido.toFixed(2)}`,
              metadata: {
                shrinkage_id: shrinkage.id,
                employee_name: employee?.full_name,
                material_name: matData?.name,
                cantidad: params.cantidad,
                valor_perdido,
                monto_descuento,
                motivo: params.motivo,
              },
            });
          }
        }
      }

      return shrinkage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-materials'] });
      qc.invalidateQueries({ queryKey: ['print-shrinkage'] });
      toast({
        title: 'Merma registrada',
        description: 'La merma ha sido registrada y notificada al dueño',
      });
    },
    onError: (e: any) => {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    },
  });
};

export const useResolveShrinkage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      shrinkage_id,
      action,
    }: {
      shrinkage_id: string;
      action: 'cobrar' | 'perdonar';
    }) => {
      if (!profile?.user_id) throw new Error('Usuario no autenticado');

      // 1. Get shrinkage details
      const { data: shrinkage, error: shrinkError } = await supabase
        .from('print_shrinkage')
        .select('*, employees!inner(id, full_name)')
        .eq('id', shrinkage_id)
        .single();

      if (shrinkError) throw shrinkError;

      const estado = action === 'cobrar' ? 'cobrado' : 'perdonado';

      // 2. Update shrinkage status
      const { error: updateError } = await supabase
        .from('print_shrinkage')
        .update({
          estado,
          resuelto_por: profile.user_id,
          resuelto_at: new Date().toISOString(),
        })
        .eq('id', shrinkage_id);

      if (updateError) throw updateError;

      // 3. If "cobrar", create salary deduction
      if (action === 'cobrar' && shrinkage.monto_descuento > 0) {
        // Get employee_id from user_id
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_user_id', shrinkage.user_id)
          .eq('business_id', shrinkage.business_id)
          .single();

        if (employee) {
          const today = new Date();
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

          await supabase.from('employee_salary_deductions').insert({
            business_id: shrinkage.business_id,
            employee_id: employee.id,
            concepto: `Merma - ${shrinkage.motivo}`,
            monto: shrinkage.monto_descuento,
            referencia_id: shrinkage_id,
            referencia_tipo: 'merma',
            periodo_inicio: today.toISOString().split('T')[0],
            periodo_fin: endOfMonth.toISOString().split('T')[0],
            aplicado: false,
            created_by: profile.user_id,
            notas: `Merma de ${shrinkage.cantidad} unidades`,
          });
        }
      }

      return { action, shrinkage };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['print-shrinkage'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['employee-salary-deductions'] });
      toast({
        title: data.action === 'cobrar' ? 'Merma cobrada' : 'Merma perdonada',
        description:
          data.action === 'cobrar'
            ? 'Se ha creado una deducción en la nómina del empleado'
            : 'La merma se registró como incidente sin impacto salarial',
      });
    },
    onError: (e: any) => {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      });
    },
  });
};
