import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { toast } from '@/hooks/use-toast';
import { getAllFromStore, putInStore, putManyInStore, addPendingOperation } from '@/lib/offlineDb';
import type { CartItem, PaymentType } from '@/types/database';

interface CreateSaleParams {
  branchId: string;
  items: CartItem[];
  paymentType: PaymentType;
  discount: number;
  amountPaid: number;
  customerId?: string;
  notes?: string;
  cashAmount?: number;
  transferAmount?: number;
}

export const useSales = (branchId?: string | null) => {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();

  // Query: list sales with seller and customer names
  const salesQuery = useQuery({
    queryKey: ['sales', branchId],
    queryFn: async () => {
      if (!branchId) return [];

      // Try online first
      if (isOnline) {
        try {
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('*, customers(name)')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

          if (salesError) throw salesError;
          if (!salesData || salesData.length === 0) return [];

          // Fetch seller names
          const userIds = [...new Set(salesData.map((s: any) => s.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          const profileMap = new Map<string, string>();
          profiles?.forEach((p: any) => profileMap.set(p.user_id, p.full_name));

          // Fetch product names for each sale
          const saleIds = salesData.map((s: any) => s.id);
          const { data: allItems } = await supabase
            .from('sale_items')
            .select('sale_id, products(name)')
            .in('sale_id', saleIds);

          const saleProductMap = new Map<string, string>();
          const saleItemCountMap = new Map<string, number>();
          if (allItems) {
            const grouped: Record<string, string[]> = {};
            const countMap: Record<string, number> = {};
            for (const item of allItems) {
              if (!grouped[item.sale_id]) grouped[item.sale_id] = [];
              countMap[item.sale_id] = (countMap[item.sale_id] || 0) + 1;
              const name = (item as any).products?.name;
              if (name) grouped[item.sale_id].push(name);
            }
            for (const [saleId, names] of Object.entries(grouped)) {
              saleProductMap.set(saleId, names.join(', '));
            }
            for (const [saleId, count] of Object.entries(countMap)) {
              saleItemCountMap.set(saleId, count);
            }
          }

          const result = salesData.map((s: any) => ({
            ...s,
            seller_name: profileMap.get(s.user_id) ?? 'Desconocido',
            customer_name: s.customers?.name ?? 'Público general',
            product_names: saleProductMap.get(s.id) ?? '',
            item_count: saleItemCountMap.get(s.id) ?? 0,
          }));

          // Cache to IndexedDB
          await putManyInStore('sales', result);
          return result;
        } catch (err) {
          console.warn('Online fetch failed, falling back to offline:', err);
        }
      }

      // Offline: read from IndexedDB
      const cached = await getAllFromStore<any>('sales', 'by-branch', branchId);
      return cached.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!branchId,
  });

  // Query: sale items for a specific sale
  const useSaleItems = (saleId: string | null) =>
    useQuery({
      queryKey: ['sale-items', saleId],
      queryFn: async () => {
        if (!saleId) return [];

        if (isOnline) {
          try {
            const { data, error } = await supabase
              .from('sale_items')
              .select('*, products(name, code)')
              .eq('sale_id', saleId);

            if (error) throw error;
            const result = (data || []).map((item: any) => ({
              ...item,
              product_name: item.products?.name ?? '',
              product_code: item.products?.code ?? '',
            }));
            return result;
          } catch {
            // fall through to offline
          }
        }

        const cached = await getAllFromStore<any>('sale_items', 'by-sale', saleId);
        return cached;
      },
      enabled: !!saleId,
    });

  // Mutation: create sale (offline-capable)
  const createSale = useMutation({
    mutationFn: async ({ branchId, items, paymentType, discount, amountPaid, customerId, notes, cashAmount, transferAmount }: CreateSaleParams) => {
      if (!user?.id) throw new Error('No hay usuario autenticado');

      if (navigator.onLine) {
        // Online: use Supabase directly
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
            cash_amount: cashAmount || 0,
            transfer_amount: transferAmount || 0,
          })
          .select()
          .single();

        if (saleError) throw saleError;

        const itemsNeedingFallback = items.filter((item) => Number(item.product.cost_price || 0) <= 0);
        const fallbackCostMap = new Map<string, number>();

        if (itemsNeedingFallback.length > 0) {
          const productIds = [...new Set(itemsNeedingFallback.map((item) => item.product.id))];
          const { data: stockEntries } = await supabase
            .from('product_stock_entries')
            .select('product_id, unit_cost, created_at')
            .eq('branch_id', branchId)
            .in('product_id', productIds)
            .gt('unit_cost', 0)
            .order('created_at', { ascending: false });

          (stockEntries || []).forEach((entry: any) => {
            if (!fallbackCostMap.has(entry.product_id)) {
              fallbackCostMap.set(entry.product_id, Number(entry.unit_cost));
            }
          });
        }

        const saleItems = items.map(item => {
          const baseCost = Number(item.product.cost_price || 0);
          const fallbackCost = fallbackCostMap.get(item.product.id) || 0;

          return {
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            cost_price: baseCost > 0 ? baseCost : fallbackCost,
            discount: item.discount,
            total: item.total,
          };
        });

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;
        return sale;
      } else {
        // Offline: save to IndexedDB and queue for sync
        const saleId = crypto.randomUUID();
        const saleNumber = `VTA-OFF-${Date.now()}`;
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const total = subtotal - discount;

        const sale = {
          id: saleId,
          branch_id: branchId,
          user_id: user.id,
          customer_id: customerId || null,
          sale_number: saleNumber,
          subtotal,
          discount,
          total,
          payment_type: paymentType,
          status: paymentType === 'credit' ? 'pending' : 'completed',
          amount_paid: amountPaid,
          notes: notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          seller_name: 'Tú',
          customer_name: 'Público general',
          _offline: true,
        };

        const saleItems = items.map(item => ({
          id: crypto.randomUUID(),
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          cost_price: item.product.cost_price,
          discount: item.discount,
          total: item.total,
          created_at: new Date().toISOString(),
          product_name: item.product.name,
          product_code: item.product.code,
        }));

        // Save to IndexedDB
        await putInStore('sales', sale);
        await putManyInStore('sale_items', saleItems);

        // Update local branch_stock (decrease quantity)
        for (const item of items) {
          const stocks = await getAllFromStore<any>('branch_stock', 'by-branch', branchId);
          const bs = stocks.find(s => s.product_id === item.product.id);
          if (bs) {
            bs.quantity = Math.max(0, bs.quantity - item.quantity);
            await putInStore('branch_stock', bs);
          }
        }

        // Queue for cloud sync
        await addPendingOperation({
          table: 'sales',
          operation: 'insert',
          data: {
            id: saleId,
            branch_id: branchId,
            user_id: user.id,
            customer_id: customerId || null,
            sale_number: saleNumber,
            subtotal,
            discount,
            total,
            payment_type: paymentType,
            status: paymentType === 'credit' ? 'pending' : 'completed',
            amount_paid: amountPaid,
            notes: notes || null,
          },
          branchId,
        });

        // Queue sale items
        for (const item of saleItems) {
          await addPendingOperation({
            table: 'sale_items',
            operation: 'insert',
            data: {
              id: item.id,
              sale_id: saleId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              cost_price: item.cost_price,
              discount: item.discount,
              total: item.total,
            },
            branchId,
          });
        }

        return sale;
      }
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Venta completada',
        description: `Venta ${sale.sale_number} por $${sale.total.toFixed(2)}${!isOnline ? ' (guardada offline)' : ''}`
      });
      // Audit log
      const itemCount = (sale as any)._offline ? 0 : undefined;
      auditLog(
        'sale_created',
        `Venta registrada por $${sale.total.toFixed(2)} — ${sale.sale_number}`,
        sale.id,
        'sale'
      );
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
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (isOnline) {
        const { error } = await supabase
          .from('sales')
          .update({ status: 'cancelled' as const, cancellation_reason: reason } as any)
          .eq('id', saleId);
        if (error) throw error;
      } else {
        const sales = await getAllFromStore<any>('sales');
        const sale = sales.find(s => s.id === saleId);
        if (sale) {
          sale.status = 'cancelled';
          sale.cancellation_reason = reason;
          await putInStore('sales', sale);
        }
        await addPendingOperation({
          table: 'sales',
          operation: 'update',
          data: { id: saleId, status: 'cancelled', cancellation_reason: reason },
        });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: 'Venta cancelada' });
      auditLog(
        'sale_cancelled',
        `Venta cancelada — motivo: ${variables.reason}`,
        variables.saleId,
        'sale'
      );
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

      if (isOnline) {
        const { error } = await supabase
          .from('sales')
          .update({ amount_paid: newAmountPaid, status: newStatus as 'completed' | 'pending' })
          .eq('id', saleId);
        if (error) throw error;
      } else {
        const sales = await getAllFromStore<any>('sales');
        const sale = sales.find(s => s.id === saleId);
        if (sale) {
          sale.amount_paid = newAmountPaid;
          sale.status = newStatus;
          await putInStore('sales', sale);
        }
        await addPendingOperation({
          table: 'sales',
          operation: 'update',
          data: { id: saleId, amount_paid: newAmountPaid, status: newStatus },
        });
      }
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
