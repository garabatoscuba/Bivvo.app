import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Package } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Commission {
  product_id: string;
  commission_type: 'fixed' | 'percent' | 'profit_percent';
  commission_value: number;
}

const CommissionsTab = ({ businessId }: { businessId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products-for-commissions', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, code, sale_price, cost_price, category:categories(name)')
        .eq('business_id', businessId)
        .neq('status', 'discontinued')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch existing commissions
  const { data: existingCommissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ['product-commissions', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_commissions')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Local state for edits
  const [edits, setEdits] = useState<Record<string, Commission>>({});

  const getCommission = (productId: string): Commission => {
    if (edits[productId]) return edits[productId];
    const existing = existingCommissions.find((c: any) => c.product_id === productId);
    if (existing) return {
      product_id: productId,
      commission_type: existing.commission_type as 'fixed' | 'percent',
      commission_value: Number(existing.commission_value),
    };
    return { product_id: productId, commission_type: 'fixed', commission_value: 0 };
  };

  const updateEdit = (productId: string, field: string, value: any) => {
    const current = getCommission(productId);
    setEdits(prev => ({
      ...prev,
      [productId]: { ...current, [field]: value },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build all commissions to upsert
      const upserts = products.map((p: any) => {
        const comm = getCommission(p.id);
        return {
          business_id: businessId,
          product_id: p.id,
          commission_type: comm.commission_type,
          commission_value: comm.commission_value,
        };
      });

      // Delete existing and insert all
      await supabase.from('product_commissions').delete().eq('business_id', businessId);
      if (upserts.length > 0) {
        const { error } = await supabase.from('product_commissions').insert(upserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-commissions'] });
      setEdits({});
      toast({ title: 'Comisiones guardadas' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const isLoading = loadingProducts || loadingCommissions;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Comisiones por Producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Define cuánto gana un empleado de comisión por cada producto vendido. Las comisiones son colectivas y se dividen entre los trabajadores activos del día.
          </p>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay productos registrados</p>
          ) : (
            <div className="space-y-2">
              {/* Header */}
               <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground border-b pb-2 px-1">
                 <span className="col-span-4">Producto</span>
                 <span className="col-span-2 text-right">Precio</span>
                 <span className="col-span-1 text-right">Gan.</span>
                 <span className="col-span-3 text-center">Tipo</span>
                 <span className="col-span-2 text-center">Valor</span>
               </div>

              {products.map((product: any) => {
                const comm = getCommission(product.id);
                const profit = Number(product.sale_price) - Number(product.cost_price || 0);
                return (
                  <div key={product.id} className="grid grid-cols-12 gap-2 items-center rounded-lg border p-2">
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{product.code}</span>
                        {product.category?.name && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{product.category.name}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-medium">${Number(product.sale_price).toFixed(2)}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-xs text-muted-foreground">${profit.toFixed(0)}</span>
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={comm.commission_type}
                        onValueChange={v => updateEdit(product.id, 'commission_type', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                         <SelectItem value="fixed">$ Fijo</SelectItem>
                          <SelectItem value="percent">% Precio</SelectItem>
                          <SelectItem value="profit_percent">% Ganancia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step={comm.commission_type === 'percent' ? 1 : 0.01}
                        value={comm.commission_value || ''}
                        onChange={e => updateEdit(product.id, 'commission_value', parseFloat(e.target.value) || 0)}
                        className="h-8 text-center text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Guardar Comisiones
      </Button>
    </div>
  );
};

export default CommissionsTab;
