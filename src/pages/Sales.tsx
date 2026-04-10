import { useState, useMemo, useCallback } from 'react';
import { KitchenOrderStatus } from '@/components/pos/KitchenOrderStatus';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, DollarSign, ShoppingCart, TrendingUp, CreditCard, X, Banknote, AlertTriangle, Loader2, Wrench, Search, ArrowUp, ArrowDown, ArrowUpDown, Printer } from 'lucide-react';
import { PeriodFilter, type Period } from '@/components/ui/period-filter';
import { isInPeriod } from '@/lib/periodUtils';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSales } from '@/hooks/useSales';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';
import { supabase } from '@/integrations/supabase/client';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { PaymentType, SaleStatus } from '@/types/database';

const paymentLabels: Record<PaymentType, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Crédito',
  mixed: 'Mixto',
};

const paymentColors: Record<PaymentType, string> = {
  cash: 'bg-success/15 text-success',
  card: 'bg-info/15 text-info',
  transfer: 'bg-primary/15 text-primary',
  credit: 'bg-warning/15 text-warning',
  mixed: 'bg-accent/15 text-accent-foreground',
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

type SortKey = 'created_at' | 'total' | 'sale_number' | 'seller_name' | 'payment_type' | 'status' | 'product_names' | 'item_count' | '_type';
type SortDir = 'asc' | 'desc';

const Sales = () => {
  const { profile, isOwner, isManager, isSuperAdmin, isSeller } = useAuth();
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const { businessId: resolvedBusinessId, branchId: resolvedBranchId } = useResolvedBusinessId();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;
  const isSellOnly = isSeller && !isPrivileged;

  // Check if business is restaurant for kitchen order status badges
  const { data: salesBusinessData } = useQuery({
    queryKey: ['sales-business-type', resolvedBusinessId],
    queryFn: async () => {
      if (!resolvedBusinessId) return null;
      const { data } = await supabase.from('businesses').select('business_type').eq('id', resolvedBusinessId).maybeSingle();
      return data;
    },
    enabled: !!resolvedBusinessId,
    staleTime: 5 * 60 * 1000,
  });
  const isRestaurantBiz = salesBusinessData?.business_type === 'estaurente/safetería';

  const branchId = resolvedBranchId || profile?.branch_id;
  const { sales, isLoadingSales, useSaleItems, cancelSale, registerPayment } = useSales(branchId);

  // Fetch branch name
  const { data: branchName } = useQuery({
    queryKey: ['branch-name', branchId],
    queryFn: async () => {
      if (!branchId) return '';
      const { data } = await supabase.from('branches').select('name').eq('id', branchId).single();
      return data?.name || '';
    },
    enabled: !!branchId,
  });

  // Fetch service entries for the branch
  const bizId = resolvedBusinessId || profile?.business_id;
  const { data: serviceEntries = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['branch-service-entries', branchId, bizId],
    queryFn: async () => {
      if (!bizId || !branchId) return [];
      let query = supabase
        .from('service_entries')
        .select('*, service_categories(name)')
        .eq('business_id', bizId)
        .eq('branch_id', branchId);
      if (isSellOnly && profile?.user_id) {
        query = query.eq('user_id', profile.user_id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return (data || []).map((s: any) => ({
        id: s.id,
        created_at: s.created_at,
        total: Number(s.amount),
        payment_type: s.payment_type as PaymentType,
        status: 'completed' as SaleStatus,
        sale_number: '',
        seller_name: '',
        customer_name: '',
        product_names: s.service_categories?.name || 'Servicio',
        _type: 'service' as const,
        description: s.description,
        user_id: s.user_id,
        item_count: 1,
        cash_amount: 0,
        transfer_amount: 0,
      }));
    },
    enabled: !!branchId && !!bizId,
  });

  // Fetch print jobs for copy_shop businesses
  const { data: printJobs = [], isLoading: isLoadingPrintJobs } = useQuery({
    queryKey: ['branch-print-jobs', branchId, bizId],
    queryFn: async () => {
      if (!bizId || !branchId) return [];
      let query = supabase
        .from('print_jobs')
        .select('*, print_job_items(service_type_id, cantidad, precio_cobrado, es_color, print_service_types(name))')
        .eq('business_id', bizId)
        .eq('branch_id', branchId);
      if (isSellOnly && profile?.user_id) {
        query = query.eq('user_id', profile.user_id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return (data || []).map((j: any) => {
        const itemNames = (j.print_job_items || []).map((it: any) => it.print_service_types?.name || 'Impresión').join(', ');
        const itemCount = (j.print_job_items || []).reduce((s: number, it: any) => s + Number(it.cantidad || 1), 0);
        return {
          id: j.id,
          created_at: j.created_at,
          total: Number(j.total),
          payment_type: j.payment_method as PaymentType,
          status: 'completed' as SaleStatus,
          sale_number: '',
          seller_name: '',
          customer_name: '',
          product_names: itemNames || 'Impresión',
          _type: 'print' as const,
          description: j.nota,
          user_id: j.user_id,
          item_count: itemCount,
          cash_amount: 0,
          transfer_amount: 0,
        };
      });
    },
    enabled: !!branchId && !!bizId,
  });

  // Build seller name map from employees table
  const { data: sellerNameMap = new Map<string, string>() } = useQuery({
    queryKey: ['seller-name-map', bizId],
    queryFn: async () => {
      if (!bizId) return new Map<string, string>();
      const { data: employees } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('business_id', bizId);
      const map = new Map<string, string>();
      if (employees?.length) {
        const emails = employees.map(e => e.email).filter(Boolean) as string[];
        if (emails.length) {
          const { data: profileLinks } = await supabase.rpc('get_profiles_by_emails', { emails });
          const emailToName = new Map<string, string>();
          employees.forEach(e => { if (e.email) emailToName.set(e.email, e.full_name); });
          profileLinks?.forEach((p: any) => {
            const name = emailToName.get(p.email);
            if (name) map.set(p.user_id, name);
          });
        }
      }
      if (profile) {
        if (!map.has(profile.user_id)) {
          map.set(profile.user_id, profile.full_name);
        }
      }
      return map;
    },
    enabled: !!bizId,
  });

  const sellerList = useMemo(() => {
    return Array.from(sellerNameMap.entries()).map(([userId, name]) => ({ user_id: userId, full_name: name }));
  }, [sellerNameMap]);

  // Merge sales + services into unified list
  // Sellers only see their own sales, filtered to today
  const unifiedEntries = useMemo(() => {
    let filteredSales = isSellOnly && profile?.user_id
      ? sales.filter((s: any) => s.user_id === profile.user_id)
      : sales;
    // Sellers only see today
    if (isSellOnly) {
      const todayStr = new Date().toISOString().slice(0, 10);
      filteredSales = filteredSales.filter((s: any) => s.created_at?.slice(0, 10) === todayStr);
    }
    const salesWithType = filteredSales.map((s: any) => ({
      ...s,
      _type: 'sale' as const,
      seller_name: sellerNameMap.get(s.user_id) || s.seller_name || 'Desconocido',
    }));
    let filteredServices = isSellOnly && profile?.user_id
      ? serviceEntries.filter((s: any) => s.user_id === profile.user_id)
      : serviceEntries;
    if (isSellOnly) {
      const todayStr = new Date().toISOString().slice(0, 10);
      filteredServices = filteredServices.filter((s: any) => s.created_at?.slice(0, 10) === todayStr);
    }
    const servicesWithSeller = filteredServices.map((s: any) => ({
      ...s,
      seller_name: sellerNameMap.get(s.user_id) || '',
    }));
    // Print jobs
    let filteredPrintJobs = isSellOnly && profile?.user_id
      ? printJobs.filter((s: any) => s.user_id === profile.user_id)
      : printJobs;
    if (isSellOnly) {
      const todayStr = new Date().toISOString().slice(0, 10);
      filteredPrintJobs = filteredPrintJobs.filter((s: any) => s.created_at?.slice(0, 10) === todayStr);
    }
    const printsWithSeller = filteredPrintJobs.map((s: any) => ({
      ...s,
      seller_name: sellerNameMap.get(s.user_id) || '',
    }));
    const merged = [...salesWithType, ...servicesWithSeller, ...printsWithSeller];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  }, [sales, serviceEntries, printJobs, isSellOnly, profile?.user_id, sellerNameMap]);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [metricsPeriod, setMetricsPeriod] = useState<Period>('today');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const selectedEntry = useMemo(() => unifiedEntries.find((s: any) => s.id === selectedSaleId), [unifiedEntries, selectedSaleId]);
  const selectedSale = useMemo(() => sales.find((s: any) => s.id === selectedSaleId), [sales, selectedSaleId]);
  const isServiceDetail = selectedEntry?._type === 'service';
  const isPrintDetail = selectedEntry?._type === 'print';
  const isNonSaleDetail = isServiceDetail || isPrintDetail;
  const { data: saleItems = [], isLoading: isLoadingItems } = useSaleItems(isNonSaleDetail ? null : selectedSaleId);

  // Metrics — respond to period filter
  const entriesInPeriod = useMemo(() => unifiedEntries.filter((s: any) => s.status !== 'cancelled' && isInPeriod(s.created_at, metricsPeriod)), [unifiedEntries, metricsPeriod]);
  const totalInPeriod = entriesInPeriod.reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const avgTicket = entriesInPeriod.length > 0 ? totalInPeriod / entriesInPeriod.length : 0;
  const pendingInPeriod = useMemo(() => unifiedEntries.filter((s: any) => s.status === 'pending' && isInPeriod(s.created_at, metricsPeriod)), [unifiedEntries, metricsPeriod]);
  const pendingTotal = pendingInPeriod.reduce((sum: number, s: any) => sum + (Number(s.total) - Number(s.amount_paid || 0)), 0);

  // Filtered entries (unified) — now also filtered by period, search, and type
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return unifiedEntries.filter((s: any) => {
      // Period filter
      if (!isInPeriod(s.created_at, metricsPeriod)) return false;
      // Type filter
      if (filterType !== 'all' && s._type !== filterType) return false;
      if (filterPayment !== 'all' && s.payment_type !== filterPayment) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterEmployee !== 'all' && s.user_id !== filterEmployee) return false;
      // Search
      if (q) {
        const haystack = [s.sale_number, s.product_names, s.seller_name, s.description].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [unifiedEntries, filterType, filterPayment, filterStatus, filterEmployee, searchQuery, metricsPeriod]);

  // Sorted entries
  const sortedEntries = useMemo(() => {
    const arr = [...filteredEntries];
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case 'created_at': va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); break;
        case 'total': va = Number(a.total); vb = Number(b.total); break;
        case 'item_count': va = Number(a.item_count || 0); vb = Number(b.item_count || 0); break;
        default: va = (a[sortKey] || '').toString().toLowerCase(); vb = (b[sortKey] || '').toString().toLowerCase(); break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredEntries, sortKey, sortDir]);

  const pendingSales = useMemo(() => unifiedEntries.filter((s: any) => s.status === 'pending'), [unifiedEntries]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (entries: any[]) => {
    const allSelected = entries.every(e => selectedIds.has(e.id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map(e => e.id)));
  };
  const selectedTotal = useMemo(() => sortedEntries.filter(e => selectedIds.has(e.id)).reduce((sum, e) => sum + Number(e.total), 0), [sortedEntries, selectedIds]);
  const selectedCount = useMemo(() => sortedEntries.filter(e => selectedIds.has(e.id)).length, [sortedEntries, selectedIds]);

  const openDetail = (saleId: string) => { setSelectedSaleId(saleId); setSheetOpen(true); };
  const canCancel = isOwner || isManager || isSuperAdmin || isSeller;

  const handleCancel = () => {
    if (!selectedSaleId || !cancelReason.trim()) return;
    cancelSale.mutate({ saleId: selectedSaleId, reason: cancelReason.trim() }, {
      onSuccess: () => { setSheetOpen(false); setCancelDialogOpen(false); setCancelReason(''); },
    });
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
      onSuccess: () => { setPaymentDialogOpen(false); setPaymentAmount(''); },
    });
  };

  // Sortable header component
  const SortableHead = ({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className || ''}`} onClick={() => toggleSort(sortKeyName)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyName ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );

  // Payment display with mixed breakdown
  const PaymentDisplay = ({ sale }: { sale: any }) => {
    if (sale.payment_type === 'mixed' && (Number(sale.cash_amount) > 0 || Number(sale.transfer_amount) > 0)) {
      return (
        <div className="space-y-0.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors.mixed}`}>
            Mixto
          </span>
          <div className="text-[10px] text-muted-foreground leading-tight">
            ${Number(sale.cash_amount).toFixed(2)} efvo + ${Number(sale.transfer_amount).toFixed(2)} transf
          </div>
        </div>
      );
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors[sale.payment_type as PaymentType]}`}>
        {paymentLabels[sale.payment_type as PaymentType]}
      </span>
    );
  };

  const SalesTable = ({ data }: { data: any[] }) => (
    <>
      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 mb-3">
          <span className="text-sm font-medium">{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">Total: ${selectedTotal.toFixed(2)}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">Limpiar</Button>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No hay registros para mostrar</p>
        ) : (
          data.map((sale: any) => (
            <div key={sale.id} className={`border rounded-lg p-3 space-y-2 cursor-pointer ${selectedIds.has(sale.id) ? 'border-primary bg-primary/5' : 'active:bg-accent/50'}`}>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggleSelect(sale.id)} onClick={(e) => e.stopPropagation()} />
                <div className="flex-1" onClick={() => openDetail(sale.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {sale._type === 'service' ? (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5"><Wrench className="h-2.5 w-2.5" />Servicio</Badge>
                      ) : sale._type === 'print' ? (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5"><Printer className="h-2.5 w-2.5" />Impresión</Badge>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{sale.sale_number}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es })}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-semibold text-base">${Number(sale.total).toFixed(2)}</span>
                    <div className="flex gap-1.5">
                      <PaymentDisplay sale={sale} />
                      {sale._type !== 'service' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[sale.status as SaleStatus]}`}>
                          {statusLabels[sale.status as SaleStatus]}
                        </span>
                      )}
                      {isRestaurantBiz && sale._type === 'sale' && sale.status === 'completed' && resolvedBusinessId && (
                        <KitchenOrderStatus saleId={sale.id} businessId={resolvedBusinessId} />
                      )}
                    </div>
                  </div>
                  {sale.seller_name && <p className="text-[10px] text-muted-foreground">{sale.seller_name}</p>}
                  {sale.product_names && <p className="text-xs text-muted-foreground truncate mt-0.5">{sale.product_names}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="border rounded-md hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={data.length > 0 && data.every(e => selectedIds.has(e.id))} onCheckedChange={() => toggleSelectAll(data)} />
              </TableHead>
              <SortableHead label="Tipo" sortKeyName="_type" />
              <SortableHead label="Ref." sortKeyName="sale_number" />
              <SortableHead label="Fecha" sortKeyName="created_at" />
              <SortableHead label="Descripción" sortKeyName="product_names" />
              <SortableHead label="Empleado" sortKeyName="seller_name" />
              <SortableHead label="Ítems" sortKeyName="item_count" className="text-center" />
              <SortableHead label="Pago" sortKeyName="payment_type" />
              <SortableHead label="Total" sortKeyName="total" className="text-right" />
              <SortableHead label="Estado" sortKeyName="status" />
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">No hay registros para mostrar</TableCell>
              </TableRow>
            ) : (
              data.map((sale: any) => (
                <TableRow key={sale.id} className={selectedIds.has(sale.id) ? 'bg-primary/5' : ''}>
                  <TableCell><Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggleSelect(sale.id)} /></TableCell>
                  <TableCell>
                    {sale._type === 'service' ? (
                      <Badge variant="outline" className="text-[10px] gap-0.5"><Wrench className="h-3 w-3" />Servicio</Badge>
                    ) : sale._type === 'print' ? (
                      <Badge variant="outline" className="text-[10px] gap-0.5"><Printer className="h-3 w-3" />Impresión</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-0.5"><ShoppingCart className="h-3 w-3" />Venta</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{sale.sale_number || '—'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{sale.product_names || sale.description || '—'}</TableCell>
                  <TableCell className="text-sm">{sale.seller_name || '—'}</TableCell>
                  <TableCell className="text-sm text-center">{sale.item_count ?? '—'}</TableCell>
                  <TableCell><PaymentDisplay sale={sale} /></TableCell>
                  <TableCell className="text-right font-medium">${Number(sale.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[sale.status as SaleStatus]}`}>
                        {statusLabels[sale.status as SaleStatus]}
                      </span>
                      {isRestaurantBiz && sale._type === 'sale' && sale.status === 'completed' && resolvedBusinessId && (
                        <KitchenOrderStatus saleId={sale.id} businessId={resolvedBusinessId} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openDetail(sale.id)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  if (!canBypassJornada && jornadaLoading) {
    return <AppLayout title="Ventas"><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }
  if (!canBypassJornada && !jornadaActiva) {
    return <AppLayout title="Ventas"><SinJornadaActiva /></AppLayout>;
  }
  if (!canBypassJornada && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente' && jornada?.metodo_apertura !== 'qr') {
    return <AppLayout title="Ventas"><SinJornadaAutorizada /></AppLayout>;
  }

  return (
    <AppLayout title="Ventas">
      {/* Period Filter + KPI Cards */}
      <div className="flex justify-end mb-3">
        <PeriodFilter value={metricsPeriod} onChange={setMetricsPeriod} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
            <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">${totalInPeriod.toFixed(2)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{entriesInPeriod.length} registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
            <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{entriesInPeriod.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Ticket prom.</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">${avgTicket.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <CreditCard className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{pendingInPeriod.length} ventas</p>
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
          {/* Search + Filters */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="relative col-span-2 md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar referencia, descripción, empleado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="md:w-36 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tipo: Todos</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="print">Impresión</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="md:w-40 text-sm"><SelectValue placeholder="Método de Pago" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pago: Todos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="mixed">Mixto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="md:w-40 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Estado: Todos</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            {isPrivileged && sellerList.length > 0 && (
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="md:w-44 text-sm"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vendedor: Todos</SelectItem>
                  {sellerList.map((emp: any) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {isLoadingSales ? (
            <p className="text-muted-foreground py-8 text-center">Cargando ventas...</p>
          ) : (
            <SalesTable data={sortedEntries} />
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

      {/* Detail Sheet (Sales + Services) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isPrintDetail ? 'Detalle de impresión' : isServiceDetail ? 'Detalle de servicio' : 'Detalle de venta'}</SheetTitle>
            <SheetDescription>{isNonSaleDetail ? (selectedEntry?.product_names || (isPrintDetail ? 'Impresión' : 'Servicio')) : selectedSale?.sale_number}</SheetDescription>
          </SheetHeader>

          {isNonSaleDetail && selectedEntry && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Fecha</div>
                <div>{format(new Date(selectedEntry.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</div>
                <div className="text-muted-foreground">{isPrintDetail ? 'Servicios' : 'Categoría'}</div>
                <div>{selectedEntry.product_names}</div>
                <div className="text-muted-foreground">Vendedor</div>
                <div>{selectedEntry.seller_name || '—'}</div>
                <div className="text-muted-foreground">Pago</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors[selectedEntry.payment_type as PaymentType]}`}>
                    {paymentLabels[selectedEntry.payment_type as PaymentType]}
                  </span>
                </div>
                <div className="text-muted-foreground">Estado</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors['completed']}`}>Completada</span>
                </div>
                {selectedEntry.description && (
                  <>
                    <div className="text-muted-foreground">Descripción</div>
                    <div>{selectedEntry.description}</div>
                  </>
                )}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>${Number(selectedEntry.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {!isNonSaleDetail && selectedSale && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Fecha</div>
                <div>{format(new Date(selectedSale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</div>
                <div className="text-muted-foreground">Vendedor</div>
                <div>{selectedSale.seller_name}</div>
                <div className="text-muted-foreground">Cliente</div>
                <div>{selectedSale.customer_name}</div>
                {branchName && (
                  <>
                    <div className="text-muted-foreground">Sucursal</div>
                    <div>{branchName}</div>
                  </>
                )}
                <div className="text-muted-foreground">Pago</div>
                <div><PaymentDisplay sale={selectedSale} /></div>
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

              <div className="flex gap-2">
                {selectedSale.status === 'pending' && (
                  <Button onClick={() => { setPaymentAmount(''); setPaymentDialogOpen(true); }} className="flex-1">
                    <Banknote className="mr-2 h-4 w-4" />Registrar pago
                  </Button>
                )}
                {canCancel && selectedSale.status !== 'cancelled' && (
                  <Button variant="destructive" onClick={() => { setCancelReason(''); setCancelDialogOpen(true); }}>
                    <X className="mr-2 h-4 w-4" />Cancelar venta
                  </Button>
                )}
              </div>

              {selectedSale.status === 'cancelled' && (selectedSale as any).cancellation_reason && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />Motivo de cancelación
                  </div>
                  <p className="text-sm text-muted-foreground">{(selectedSale as any).cancellation_reason}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Reason Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar venta</DialogTitle>
            <DialogDescription>Explica el motivo de la cancelación. Los productos se devolverán al inventario automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo de cancelación *</Label>
            <Textarea id="cancel-reason" placeholder="Ej: Error en el cobro, cliente solicitó devolución..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Volver</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim() || cancelSale.isPending}>Confirmar cancelación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Saldo pendiente: ${selectedSale ? (Number(selectedSale.total) - Number(selectedSale.amount_paid)).toFixed(2) : '0.00'}</DialogDescription>
          </DialogHeader>
          <Input type="number" min="0.01" step="0.01" placeholder="Monto a abonar" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterPayment} disabled={registerPayment.isPending}>Confirmar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Sales;
