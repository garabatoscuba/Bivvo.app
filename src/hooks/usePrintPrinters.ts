import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from './useResolvedBusinessId';
import { useToast } from './use-toast';

export const usePrintPrinters = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-printers', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('print_printers' as any)
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!businessId,
  });
};

export const useActivePrinters = () => {
  const { businessId } = useResolvedBusinessId();
  return useQuery({
    queryKey: ['print-printers-active', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('print_printers' as any)
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!businessId,
  });
};

export const useSavePrinter = () => {
  const qc = useQueryClient();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (values: { id?: string; name: string; colores: string[]; soporta_full: boolean; is_active: boolean }) => {
      const payload = { ...values, business_id: businessId, branch_id: branchId };
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('print_printers' as any).update(rest).eq('id', id);
        if (error) throw error;
      } else {
        delete (payload as any).id;
        const { error } = await supabase.from('print_printers' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-printers'] });
      qc.invalidateQueries({ queryKey: ['print-printers-active'] });
      toast({ title: 'Impresora guardada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};

export const useDeletePrinter = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('print_printers' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-printers'] });
      qc.invalidateQueries({ queryKey: ['print-printers-active'] });
      toast({ title: 'Impresora eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
};
