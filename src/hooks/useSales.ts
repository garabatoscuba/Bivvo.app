import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export const useSales = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createSale = useMutation({
    mutationFn: async ({ branchId, items, paymentType, discount, amountPaid, customerId, notes }: CreateSaleParams) => {
      if (!user?.id) throw new Error('No hay usuario autenticado');

      // Generar número de venta
      const { data: saleNumber } = await supabase.rpc('generate_sale_number', {
        _branch_id: branchId,
      });

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const total = subtotal - discount;

      // Crear la venta
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

      // Crear los items de la venta (esto actualizará el stock automáticamente via trigger)
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

  return {
    createSale,
    isCreating: createSale.isPending,
  };
};
