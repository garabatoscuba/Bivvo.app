import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, DollarSign, ShoppingCart, TrendingUp, CreditCard, X, Banknote } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSales } from '@/hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { PaymentType, SaleStatus } from '@/types/database';

const paymentLabels: Record<PaymentType, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Crédito',
};

const paymentColors: Record<PaymentType, string> = {
  cash: 'bg-success/15 text-success',
  card: 'bg-info/15 text-info',
  transfer: 'bg-category-purple/20 text-category-purple-foreground',
  credit: 'bg-warning/15 text-warning',
};

const statusLabels: Record<SaleStatus, string> = {
  completed: 'Completada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
};

const statusColors: Record<SaleStatus, string> = {
  completed: 'bg-success/15 text-success',
  pending: 'bg-warning/15 text-warning',
  cancelled: 'bg-destructive/15 text-destructive',
};

const Sales = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const branchId = profile?.branch_id;
  const { sales, isLoadingSales, useSaleItems, cancelSale, registerPayment } = useSales(branchId);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const selectedSale = useMemo(() => sales.find((s: any) => s.id === selectedSaleId), [sales, selectedSaleId]);
  const { data: saleItems = [], isLoading: isLoadingItems } = useSaleItems(selectedSaleId);

  // Metrics
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');

  const salesToday = useMemo(() => sales.filter((s: any) => s.status !== 'cancelled' && format(new Date(s.created_at), 'yyyy-MM-dd') === todayStr), [sales, todayStr]);
  const salesMonth = useMemo(() => sales.filter((s: any) => s.status !== 'cancelled' && format(new Date(s.created_at), 'yyyy-MM-dd') >= monthStart), [sales, monthStart]);
  const totalToday = salesToday.reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const totalMonth = salesMonth.reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const avgTicket = salesMonth.length > 0 ? totalMonth / salesMonth.length : 0;
  const pendingTotal = useMemo(() => sales.filter((s: any) => s.status === 'pending').reduce((sum: number, s: any) => sum + (Number(s.total) - Number(s.amount_paid)), 0), [sales]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      if (filterPayment !== 'all' && s.payment_type !== filterPayment) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      const saleDate = format(new Date(s.created_at), 'yyyy-MM-dd');
      if (dateFrom && saleDate < dateFrom) return false;
      if (dateTo && saleDate > dateTo) return false;
      return true;
    });
  }, [sales, filterPayment, filterStatus, dateFrom, dateTo]);

  const pendingSales = useMemo(() => sales.filter((s: any) => s.status === 'pending'), [sales]);

  const openDetail = (saleId: string) => {
    setSelectedSaleId(saleId);
    setSheetOpen(true);
  };

  const canCancel = isOwner || isManager || isSuperAdmin;

  const handleCancel = () => {
    if (!selectedSaleId) return;
    cancelSale.mutate(selectedSaleId, { onSuccess: () => setSheetOpen(false) });
  };

  const handleRegisterPayment = () => {
    if (!selectedSale || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    registerPayment.mutate({
      saleId: selectedSale.id,
      currentAmountPaid: Number(selectedSale.amount_paid),
      paymentAmount: amount,
      total: Number(selectedSale.total),
    }, {
      onSuccess: () => {
        setPaymentDialogOpen(false);
        setPaymentAmount('');
      },
    });
  };

  const SalesTable = ({ data }: { data: any[] }) => (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Venta</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No hay ventas para mostrar
              </TableCell>
            </TableRow>
          ) : (
            data.map((sale: any) => (
              <TableRow key={sale.id}>
                <TableCell className="font-mono text-sm">{sale.sale_number}</TableCell>
                <TableCell className="text-sm">{format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                <TableCell className="text-sm">{sale.seller_name}</TableCell>
                <TableCell className="text-sm">{sale.customer_name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors[sale.payment_type as PaymentType]}`}>
                    {paymentLabels[sale.payment_type as PaymentType]}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">${Number(sale.total).toFixed(2)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[sale.status as SaleStatus]}`}>
                    {statusLabels[sale.status as SaleStatus]}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openDetail(sale.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppLayout title="Ventas">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalToday.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{salesToday.length} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas del mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{salesMonth.length} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTicket.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes de cobro</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{pendingSales.length} ventas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="receivables">Cuentas por cobrar ({pendingSales.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" placeholder="Desde" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" placeholder="Hasta" />
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Método de pago" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoadingSales ? (
            <p className="text-muted-foreground py-8 text-center">Cargando ventas...</p>
          ) : (
            <SalesTable data={filteredSales} />
          )}
        </TabsContent>

        <TabsContent value="receivables">
          {isLoadingSales ? (
            <p className="text-muted-foreground py-8 text-center">Cargando...</p>
          ) : (
            <SalesTable data={pendingSales} />
          )}
        </TabsContent>
      </Tabs>

      {/* Sale Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle de venta</SheetTitle>
            <SheetDescription>{selectedSale?.sale_number}</SheetDescription>
          </SheetHeader>

          {selectedSale && (
            <div className="mt-4 space-y-4">
              {/* General info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Fecha</div>
                <div>{format(new Date(selectedSale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</div>
                <div className="text-muted-foreground">Vendedor</div>
                <div>{selectedSale.seller_name}</div>
                <div className="text-muted-foreground">Cliente</div>
                <div>{selectedSale.customer_name}</div>
                <div className="text-muted-foreground">Pago</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors[selectedSale.payment_type as PaymentType]}`}>
                    {paymentLabels[selectedSale.payment_type as PaymentType]}
                  </span>
                </div>
                <div className="text-muted-foreground">Estado</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedSale.status as SaleStatus]}`}>
                    {statusLabels[selectedSale.status as SaleStatus]}
                  </span>
                </div>
                {selectedSale.notes && (
                  <>
                    <div className="text-muted-foreground">Notas</div>
                    <div>{selectedSale.notes}</div>
                  </>
                )}
              </div>

              <Separator />

              {/* Items table */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Productos</h4>
                {isLoadingItems ? (
                  <p className="text-muted-foreground text-sm">Cargando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Producto</TableHead>
                        <TableHead className="text-xs text-center">Cant.</TableHead>
                        <TableHead className="text-xs text-right">P. Unit.</TableHead>
                        <TableHead className="text-xs text-right">Desc.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-right">${Number(item.discount).toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-right font-medium">${Number(item.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Separator />

              {/* Summary */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Number(selectedSale.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span>-${Number(selectedSale.discount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>${Number(selectedSale.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagado</span>
                  <span>${Number(selectedSale.amount_paid).toFixed(2)}</span>
                </div>
                {selectedSale.status === 'pending' && (
                  <div className="flex justify-between font-medium text-destructive">
                    <span>Saldo pendiente</span>
                    <span>${(Number(selectedSale.total) - Number(selectedSale.amount_paid)).toFixed(2)}</span>
                  </div>
                )}
                {selectedSale.status === 'completed' && Number(selectedSale.amount_paid) > Number(selectedSale.total) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cambio</span>
                    <span>${(Number(selectedSale.amount_paid) - Number(selectedSale.total)).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                {selectedSale.status === 'pending' && (
                  <Button onClick={() => { setPaymentAmount(''); setPaymentDialogOpen(true); }} className="flex-1">
                    <Banknote className="mr-2 h-4 w-4" />
                    Registrar pago
                  </Button>
                )}
                {canCancel && selectedSale.status !== 'cancelled' && (
                  <Button variant="destructive" onClick={handleCancel} disabled={cancelSale.isPending}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar venta
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Saldo pendiente: ${selectedSale ? (Number(selectedSale.total) - Number(selectedSale.amount_paid)).toFixed(2) : '0.00'}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Monto a abonar"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterPayment} disabled={registerPayment.isPending}>
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Sales;
