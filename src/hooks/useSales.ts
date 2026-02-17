import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { CartItem, PaymentType } from '@/types/database';

interface CreateSaleParams {
  branchId: string;
  items: CartItem[];
  paymentType: PaymentType;
  discount: number;
  amountPaid: number;
  customerId?: string;
  notes?: string;
}

export const useSales = (branchId?: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query: list sales with seller and customer names
  const salesQuery = useQuery({
    queryKey: ['sales', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      // Fetch sales with customer join
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;
      if (!salesData || salesData.length === 0) return [];

      // Fetch seller names from profiles using user_ids
      const userIds = [...new Set(salesData.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map<string, string>();
      profiles?.forEach((p: any) => profileMap.set(p.user_id, p.full_name));

      return salesData.map((s: any) => ({
        ...s,
        seller_name: profileMap.get(s.user_id) ?? 'Desconocido',
        customer_name: s.customers?.name ?? 'Público general',
      }));
    },
    enabled: !!branchId,
  });

  // Query: sale items for a specific sale
  const useSaleItems = (saleId: string | null) =>
    useQuery({
      queryKey: ['sale-items', saleId],
      queryFn: async () => {
        if (!saleId) return [];
        const { data, error } = await supabase
          .from('sale_items')
          .select('*, products(name, code)')
          .eq('sale_id', saleId);

        if (error) throw error;
        return (data || []).map((item: any) => ({
          ...item,
          product_name: item.products?.name ?? '',
          product_code: item.products?.code ?? '',
        }));
      },
      enabled: !!saleId,
    });

  // Mutation: create sale (existing logic)
  const createSale = useMutation({
    mutationFn: async ({ branchId, items, paymentType, discount, amountPaid, customerId, notes }: CreateSaleParams) => {
      if (!user?.id) throw new Error('No hay usuario autenticado');

      const { data: saleNumber } = await supabase.rpc('generate_sale_number', {
        _branch_id: branchId,
      });

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const total = subtotal - discount;

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          branch_id: branchId,
          user_id: user.id,
          customer_id: customerId || null,
          sale_number: saleNumber || `VTA-${Date.now()}`,
          subtotal,
          discount,
          total,
          payment_type: paymentType,
          status: paymentType === 'credit' ? 'pending' : 'completed',
          amount_paid: amountPaid,
          notes: notes || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = items.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        cost_price: item.product.cost_price,
        discount: item.discount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;
      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Venta completada',
        description: `Venta ${sale.sale_number} por $${sale.total.toFixed(2)}`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al procesar venta',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Mutation: cancel sale
  const cancelSale = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'cancelled' as const })
        .eq('id', saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Venta cancelada' });
    },
    onError: (error) => {
      toast({ title: 'Error al cancelar', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: register payment on credit sale
  const registerPayment = useMutation({
    mutationFn: async ({ saleId, currentAmountPaid, paymentAmount, total }: {
      saleId: string;
      currentAmountPaid: number;
      paymentAmount: number;
      total: number;
    }) => {
      const newAmountPaid = currentAmountPaid + paymentAmount;
      const newStatus = newAmountPaid >= total ? 'completed' : 'pending';
      const { error } = await supabase
        .from('sales')
        .update({ amount_paid: newAmountPaid, status: newStatus as 'completed' | 'pending' })
        .eq('id', saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Pago registrado' });
    },
    onError: (error) => {
      toast({ title: 'Error al registrar pago', description: error.message, variant: 'destructive' });
    },
  });

  return {
    sales: salesQuery.data ?? [],
    isLoadingSales: salesQuery.isLoading,
    useSaleItems,
    createSale,
    isCreating: createSale.isPending,
    cancelSale,
    registerPayment,
  };
};
