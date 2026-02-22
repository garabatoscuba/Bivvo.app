import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const Cobros = () => {
  const { profile } = useAuth();
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  // Fetch all entries for the branch
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['service-entries-cobros', businessId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_entries')
        .select('*, service_categories(name)')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Filter by month
  const filtered = entries.filter(e => {
    const d = new Date(e.created_at);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return m === filterMonth;
  });

  // Group by category
  const byCat = filtered.reduce<Record<string, { name: string; total: number; count: number }>>((acc, e) => {
    const catName = (e as any).service_categories?.name || 'Sin categoría';
    if (!acc[catName]) acc[catName] = { name: catName, total: 0, count: 0 };
    acc[catName].total += Number(e.amount);
    acc[catName].count += 1;
    return acc;
  }, {});

  const categoryTotals = Object.values(byCat).sort((a, b) => b.total - a.total);
  const grandTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalCount = filtered.length;

  // By payment type
  const byPayment = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.payment_type] = (acc[e.payment_type] || 0) + Number(e.amount);
    return acc;
  }, {});

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
  };

  // Generate month options
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es', { month: 'long', year: 'numeric' });
    months.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Cobros de Servicios</h1>
            <p className="text-sm text-muted-foreground">Resumen de ingresos por servicios</p>
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Total</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold">${grandTotal.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Servicios</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold">{totalCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* By payment type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(byPayment).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(byPayment).map(([type, amount]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{paymentLabels[type] || type}</span>
                        <span className="text-sm font-bold">${amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By category */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryTotals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Sin datos este mes</p>
                ) : (
                  <div className="space-y-3">
                    {categoryTotals.map(cat => (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{cat.count}</Badge>
                        </div>
                        <span className="text-sm font-bold">${cat.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detail list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detalle</CardTitle>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin cobros este mes</p>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {filtered.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border p-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {(entry as any).service_categories?.name}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {paymentLabels[entry.payment_type] || entry.payment_type}
                            </Badge>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {new Date(entry.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="text-sm font-bold shrink-0 ml-2">${Number(entry.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Cobros;
