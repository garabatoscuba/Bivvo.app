import { useState } from 'react';
import { calcIngredientCost } from '@/lib/unitConversion';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useIsDowngraded } from '@/hooks/useIsDowngraded';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import DowngradeModal from '@/components/DowngradeModal';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Pencil, Trash2, Loader2, DollarSign, Send, Zap, ArrowUpCircle, Banknote, Smartphone, CreditCard, RotateCcw, CheckCircle2, ClipboardList, X, ListPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000];

type ServicePaymentType = 'cash' | 'transfer' | 'card' | 'mixed';

const ServicePaymentSection = ({
  paymentType,
  setPaymentType,
  amount,
  total,
  isMixed,
  setIsMixed,
  mixedCash,
  setMixedCash,
  mixedTransfer,
  setMixedTransfer,
}: {
  paymentType: string;
  setPaymentType: (v: string) => void;
  amount: string;
  total: number;
  isMixed: boolean;
  setIsMixed: (v: boolean) => void;
  mixedCash: string;
  setMixedCash: (v: string | ((p: string) => string)) => void;
  mixedTransfer: string;
  setMixedTransfer: (v: string) => void;
}) => {
  const paymentOptions: { value: string; label: string; Icon: React.ElementType }[] = [
    { value: 'cash', label: 'Efectivo', Icon: Banknote },
    { value: 'card', label: 'Tarjeta', Icon: CreditCard },
    { value: 'transfer', label: 'Transferencia', Icon: Smartphone },
  ];

  const handlePaymentSelect = (value: string) => {
    if (isMixed) {
      if (value === 'cash' || value === 'transfer') {
        setIsMixed(false);
        setPaymentType(value);
        return;
      }
    }
    if (
      (paymentType === 'cash' && value === 'transfer') ||
      (paymentType === 'transfer' && value === 'cash')
    ) {
      setIsMixed(true);
      setMixedCash('0');
      setMixedTransfer(total > 0 ? total.toFixed(2) : '0');
      return;
    }
    setIsMixed(false);
    setPaymentType(value);
  };

  const isActive = (v: string) => isMixed ? (v === 'cash' || v === 'transfer') : paymentType === v;

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground">Método de Pago</Label>
      <div className="grid grid-cols-3 gap-2">
        {paymentOptions.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            variant={isActive(value) ? 'default' : 'outline'}
            className={cn('flex-col h-auto py-2.5', isActive(value) && 'ring-2 ring-primary')}
            onClick={() => handlePaymentSelect(value)}
          >
            <Icon className="h-4 w-4 mb-0.5" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
      {isMixed && (
        <p className="text-xs text-muted-foreground text-center">Pago mixto: Efectivo + Transferencia</p>
      )}

      {(paymentType === 'cash' || isMixed) && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> Efectivo</Label>
            <Input type="number" step="0.01" min="0" value={mixedCash} onChange={e => setMixedCash(e.target.value)} className="text-right font-medium" />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map(a => (
                <Button key={a} type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash((p: string) => (Number(p) + a).toString())}>${a}</Button>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash(total > 0 ? total.toFixed(2) : '0')}>Exacto</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setMixedCash('0')}><RotateCcw className="h-3 w-3" /></Button>
            </div>
          </div>
          {isMixed && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Smartphone className="h-3 w-3" /> Transferencia</Label>
              <Input type="number" step="0.01" min="0" value={mixedTransfer} onChange={e => setMixedTransfer(e.target.value)} className="text-right font-medium" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
import IconSelector, { getIconComponent } from '@/components/services/IconSelector';
import ServiceCostSheet from '@/components/services/ServiceCostSheet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mixed: 'Mixto',
};

// ─── Shared: Recent entries list ───
const RecentEntriesList = ({ entries, isLoading, isOwner, onPromote }: {
  entries: any[];
  isLoading: boolean;
  isOwner: boolean;
  onPromote?: (entry: any) => void;
}) => {
  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No hay cobros registrados</p>;

  return (
    <div className="space-y-2">
      {entries.map((entry: any) => {
        const isLive = entry.is_catalog === false;
        const EntryIcon = isLive ? Zap : getIconComponent(entry.service_categories?.icon);
        return (
          <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2 min-w-0">
              <EntryIcon className={`h-4 w-4 shrink-0 ${isLive ? 'text-amber-500' : 'text-primary'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isLive ? (
                    <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                      En vivo
                    </Badge>
                  ) : null}
                  <Badge variant="secondary" className="text-[10px]">
                    {isLive ? (entry.service_name || 'Sin nombre') : entry.service_categories?.name}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{paymentLabels[entry.payment_type] || entry.payment_type}</Badge>
                </div>
                {entry.description && <p className="text-sm text-muted-foreground mt-1 truncate">{entry.description}</p>}
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {new Date(entry.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {isLive && isOwner && onPromote && (
                <button
                  onClick={() => onPromote(entry)}
                  className="p-1 rounded hover:bg-muted"
                  title="Promover al catálogo"
                >
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                </button>
              )}
              <span className="text-sm font-bold">${Number(entry.amount).toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Employee-facing view: quick service registration ───
const EmployeeServicesView = ({ employeeBusinessId, employeeBranchId }: { employeeBusinessId: string; employeeBranchId: string | null }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDowngraded } = useIsDowngraded();
  const auditLog = useAuditLog();
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const businessId = employeeBusinessId;
  const branchId = employeeBranchId;

  // Check for open cash register
  const { data: hasOpenRegister, isLoading: loadingRegister } = useQuery({
    queryKey: ['employee-open-register', branchId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('branch_id', branchId!)
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    enabled: !!branchId && !!user?.id,
  });

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentType, setPaymentType] = useState('cash');
  const [isMixed, setIsMixed] = useState(false);
  const [mixedCash, setMixedCash] = useState('0');
  const [mixedTransfer, setMixedTransfer] = useState('0');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [isLiveService, setIsLiveService] = useState(false);
  const [liveServiceName, setLiveServiceName] = useState('');
  const [tabItems, setTabItems] = useState<Array<{
    id: string; catId: string | null; name: string; icon: string;
    description: string; quantity: number; unitPrice: number; isLive: boolean;
  }>>([]);

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['service-categories', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('business_id', businessId!)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const { data: recentEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['service-entries-recent', businessId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_entries')
        .select('*, service_categories(name, icon)')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Compute current line total
  const unitPrice = parseFloat(amount) || 0;
  const lineTotal = quantity * unitPrice;
  const tabSubtotal = tabItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalACobrar = tabSubtotal + ((selectedCatId || isLiveService) && unitPrice > 0 ? lineTotal : 0);

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      // Build list of all items to insert
      const allItems: Array<{
        catId: string | null; name: string; description: string;
        quantity: number; unitPrice: number; isLive: boolean;
      }> = [...tabItems.map(t => ({
        catId: t.catId, name: t.name, description: t.description,
        quantity: t.quantity, unitPrice: t.unitPrice, isLive: t.isLive,
      }))];

      // Add current selection if present
      if ((selectedCatId || isLiveService) && unitPrice > 0) {
        allItems.push({
          catId: isLiveService ? null : selectedCatId,
          name: isLiveService ? liveServiceName.trim() : categories.find((c: any) => c.id === selectedCatId)?.name || '',
          description: description.trim(),
          quantity,
          unitPrice,
          isLive: isLiveService,
        });
      }

      // Insert each item individually
      for (const item of allItems) {
        const payload: any = {
          business_id: businessId!,
          branch_id: branchId!,
          user_id: user!.id,
          description: item.description || null,
          amount: item.quantity * item.unitPrice,
          payment_type: isMixed ? 'mixed' : paymentType,
          is_catalog: !item.isLive,
        };
        if (item.isLive) {
          payload.service_name = item.name;
          payload.category_id = null;
        } else {
          payload.category_id = item.catId;
        }
        const { error } = await supabase.from('service_entries').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-entries'] });
      queryClient.invalidateQueries({ queryKey: ['service-entries-recent'] });
      const itemCount = tabItems.length + ((selectedCatId || isLiveService) && unitPrice > 0 ? 1 : 0);
      toast({ title: `✓ ${itemCount > 1 ? `${itemCount} servicios registrados` : 'Servicio registrado'}` });
      auditLog(
        'service_charge_created',
        `Cobro de ${itemCount} servicio(s) por $${totalACobrar.toFixed(2)}`,
        undefined,
        'service_entry'
      );
      setDescription('');
      setAmount('');
      setQuantity(1);
      setSelectedCatId(null);
      setPaymentType('cash');
      setIsMixed(false);
      setMixedCash('0');
      setMixedTransfer('0');
      setPaymentDialogOpen(false);
      setIsLiveService(false);
      setLiveServiceName('');
      setTabItems([]);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleSelectCategory = (catId: string) => {
    setIsLiveService(false);
    if (selectedCatId === catId) {
      setSelectedCatId(null);
      setAmount('');
      setQuantity(1);
      return;
    }
    setSelectedCatId(catId);
    setQuantity(1);
    const cat = categories.find((c: any) => c.id === catId);
    if (cat && (cat as any).fixed_price != null && Number((cat as any).fixed_price) > 0) {
      setAmount(String(Number((cat as any).fixed_price)));
    }
  };

  const handleLiveToggle = () => {
    setIsLiveService(!isLiveService);
    setSelectedCatId(null);
    setAmount('');
    setQuantity(1);
  };

  const handleAddToTab = () => {
    if (!canAddToTab) return;
    const cat = categories.find((c: any) => c.id === selectedCatId);
    setTabItems(prev => [...prev, {
      id: crypto.randomUUID(),
      catId: isLiveService ? null : selectedCatId,
      name: isLiveService ? liveServiceName.trim() : cat?.name || '',
      icon: isLiveService ? '' : cat?.icon || '',
      description: description.trim(),
      quantity,
      unitPrice,
      isLive: isLiveService,
    }]);
    // Reset current selection
    setDescription('');
    setAmount('');
    setQuantity(1);
    setSelectedCatId(null);
    if (isLiveService) { setLiveServiceName(''); setIsLiveService(false); }
  };

  const todayEntries = recentEntries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString());
  const todayTotal = todayEntries.reduce((sum, e) => sum + Number(e.amount), 0);

  const currentItemValid = isLiveService
    ? !!liveServiceName.trim() && unitPrice > 0
    : !!selectedCatId && unitPrice > 0;
  const canAddToTab = currentItemValid && !createEntryMutation.isPending;
  const canSubmit = (currentItemValid || tabItems.length > 0) && !createEntryMutation.isPending;

  return (
    <>
    <div className="p-3 md:p-4">
      {loadingRegister ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !hasOpenRegister ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 opacity-40 mb-3" />
            <p className="text-sm font-medium">Debes abrir tu caja primero</p>
            <p className="text-xs mt-1">Ve al módulo Caja para abrir tu caja antes de registrar servicios.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-8rem)]">
          {/* ─── Left Panel: Services ─── */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h1 className="text-xl font-bold">Servicios</h1>
                <p className="text-xs text-muted-foreground">Registra cobros de servicios</p>
              </div>
              <Button variant={isLiveService ? 'default' : 'outline'} size="sm" onClick={handleLiveToggle}>
                <Zap className="h-3.5 w-3.5 mr-1" /> En vivo
              </Button>
            </div>

            {/* Total strip */}
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-2 shrink-0">
              <DollarSign className="h-5 w-5 text-primary opacity-60" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total del día</p>
                <p className="text-lg font-bold">${todayTotal.toFixed(2)}</p>
              </div>
            </div>

            {/* Service grid / live input */}
            <div className="flex-1 overflow-y-auto pb-4 lg:pb-0">
              {isLiveService ? (
                <div className="space-y-2 p-1">
                  <Label className="text-xs text-muted-foreground">Nombre del servicio</Label>
                  <Input value={liveServiceName} onChange={e => setLiveServiceName(e.target.value)} placeholder="Ej: Reparación de pantalla" />
                  <p className="text-[10px] text-muted-foreground">No se agrega al catálogo automáticamente</p>
                </div>
              ) : loadingCats ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <DollarSign className="h-10 w-10 opacity-30 mb-2" />
                  <p className="text-sm">No hay servicios configurados</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {categories.map((cat: any) => {
                    const Icon = getIconComponent(cat.icon);
                    const isSelected = selectedCatId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:shadow-sm',
                          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className={cn('rounded-lg p-2', isSelected ? 'bg-primary/10' : 'bg-muted')}>
                          <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{cat.name}</span>
                          {cat.fixed_price != null && Number(cat.fixed_price) > 0 && (
                            <span className="text-[11px] text-muted-foreground">${Number(cat.fixed_price).toFixed(2)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Recent entries */}
              {todayEntries.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recientes</p>
                  {todayEntries.slice(0, 5).map((entry: any) => {
                    const isLive = entry.is_catalog === false;
                    const EntryIcon = isLive ? Zap : getIconComponent(entry.service_categories?.icon);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <EntryIcon className={cn('h-3.5 w-3.5 shrink-0', isLive ? 'text-amber-500' : 'text-muted-foreground')} />
                          <Badge variant="secondary" className="text-[10px]">
                            {isLive ? (entry.service_name || 'En vivo') : entry.service_categories?.name}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-xs font-bold shrink-0 ml-2">${Number(entry.amount).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Right Panel: Checkout ─── */}
          <Card className="w-full lg:w-96 flex flex-col lg:max-h-full overflow-hidden flex-shrink-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm font-medium">Detalle del cobro</CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              {!selectedCatId && !isLiveService && tabItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <DollarSign className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">Selecciona un servicio</p>
                </div>
              ) : (
                <>
                  {(selectedCatId || isLiveService) && (
                    <>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        {isLiveService ? (
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">{liveServiceName || 'Servicio en vivo'}</span>
                          </div>
                        ) : (() => {
                          const cat = categories.find((c: any) => c.id === selectedCatId);
                          const CatIcon = getIconComponent(cat?.icon);
                          return (
                            <div className="flex items-center gap-2">
                              <CatIcon className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{cat?.name}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle del servicio..." rows={2} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Precio unitario ($)</Label>
                        <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="mt-1 text-lg font-medium text-right" />
                      </div>
                      {/* Quantity control */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Cantidad</Label>
                        <div className="flex items-center gap-3 mt-1">
                          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => q + 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          {unitPrice > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto">
                              {quantity} × ${unitPrice.toFixed(2)} = <span className="font-bold text-foreground">${lineTotal.toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Add to tab button */}
                      <Button type="button" variant="outline" className="w-full" onClick={handleAddToTab} disabled={!canAddToTab}>
                        <ListPlus className="h-4 w-4 mr-1" /> Agregar a cuenta
                      </Button>
                    </>
                  )}

                  {/* Open tab items */}
                  {tabItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" /> Cuenta abierta ({tabItems.length})
                      </p>
                      {tabItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border p-2.5">
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{item.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                            </span>
                          </div>
                          <button onClick={() => setTabItems(prev => prev.filter(t => t.id !== item.id))} className="p-1 rounded hover:bg-destructive/10">
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="text-muted-foreground">Subtotal cuenta</span>
                        <span className="font-bold">${tabSubtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {(selectedCatId || isLiveService || tabItems.length > 0) && (
              <div className="p-4 border-t space-y-2 shrink-0">
                {totalACobrar > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total a cobrar</span>
                    <span className="text-xl font-bold">${totalACobrar.toFixed(2)}</span>
                  </div>
                )}
                <Button className="w-full h-11 font-bold" onClick={() => setPaymentDialogOpen(true)} disabled={!canSubmit || totalACobrar <= 0}>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Cobrar {totalACobrar > 0 ? `$${totalACobrar.toFixed(2)}` : ''}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>

    {/* ─── Payment Dialog ─── */}
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Procesar Pago</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${totalACobrar.toFixed(2)}</span>
            </div>
            {tabItems.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{tabItems.length + (currentItemValid ? 1 : 0)} servicio(s)</p>
            )}
          </div>
          <ServicePaymentSection
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            amount={totalACobrar.toFixed(2)}
            total={totalACobrar}
            isMixed={isMixed}
            setIsMixed={setIsMixed}
            mixedCash={mixedCash}
            setMixedCash={setMixedCash}
            mixedTransfer={mixedTransfer}
            setMixedTransfer={setMixedTransfer}
          />
          {!isMixed && paymentType === 'cash' && Number(mixedCash) > totalACobrar && totalACobrar > 0 && (
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">Cambio</p>
              <p className="text-2xl font-bold text-primary">${(Number(mixedCash) - totalACobrar).toFixed(2)}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
          <Button onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } createEntryMutation.mutate(); }} disabled={!canSubmit} className="min-w-32">
            {createEntryMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <DowngradeModal open={downgradeModalOpen} onOpenChange={setDowngradeModalOpen} />
    </>
  );
};

// ─── Owner/Manager view: tabs — Catálogo, Cobros, Análisis ───
const OwnerServicesView = () => {
  const { profile, user, isOwner, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDowngraded } = useIsDowngraded();
  const auditLog = useAuditLog();
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const { canCreateServiceCategory, serviceCategoryLimit } = usePlanFeatures();
  const canManage = isOwner || isManager;
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string; icon?: string; fixed_price?: number | null } | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('DollarSign');
  const [catFixedPrice, setCatFixedPrice] = useState('');

  // Cost sheet state
  const [costSheetOpen, setCostSheetOpen] = useState(false);
  const [costSheetCatId, setCostSheetCatId] = useState('');
  const [costSheetCatName, setCostSheetCatName] = useState('');

  // Entry dialog state
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPaymentType, setEntryPaymentType] = useState('cash');
  const [entryIsMixed, setEntryIsMixed] = useState(false);
  const [entryMixedCash, setEntryMixedCash] = useState('0');
  const [entryMixedTransfer, setEntryMixedTransfer] = useState('0');
  const [entryIsLive, setEntryIsLive] = useState(false);
  const [entryLiveName, setEntryLiveName] = useState('');

  // Promote dialog
  const [promoteEntry, setPromoteEntry] = useState<any>(null);

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['service-categories', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('business_id', businessId!)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch cost summaries for all categories (cost per unit using yield)
  const { data: costSummaries = {} } = useQuery({
    queryKey: ['service-cost-summary', businessId],
    queryFn: async () => {
      const catIds = categories.map((c: any) => c.id);
      const { data: ingredients, error } = await supabase
        .from('service_cost_ingredients' as any)
        .select('category_id, quantity, unit, ingredient_type, raw_materials(costo_unitario, unit_purchase)')
        .in('category_id', catIds);
      if (error) throw error;

      // Build recipe cost per category (base ingredients only)
      const recipeCostMap: Record<string, number> = {};
      const hasCost: Record<string, boolean> = {};
      (ingredients as any[] || []).forEach((row: any) => {
        hasCost[row.category_id] = true;
        if (row.ingredient_type !== 'base') return;
        const costPerPurchaseUnit = Number(row.raw_materials?.costo_unitario) || 0;
        const purchaseUnit = row.raw_materials?.unit_purchase || 'pieza';
        const usedUnit = row.unit || purchaseUnit;
        const qty = Number(row.quantity) || 0;
        // Use calcIngredientCost for proper unit conversion
        const cost = calcIngredientCost(qty, usedUnit, costPerPurchaseUnit, purchaseUnit);
        recipeCostMap[row.category_id] = (recipeCostMap[row.category_id] || 0) + cost;
      });

      // Divide by yield to get cost per unit
      const map: Record<string, number | null> = {};
      catIds.forEach((id: string) => {
        if (!hasCost[id]) {
          map[id] = null; // no ingredients configured
          return;
        }
        const cat = categories.find((c: any) => c.id === id);
        const yieldQty = (cat as any)?.yield_quantity || 1;
        map[id] = (recipeCostMap[id] || 0) / yieldQty;
      });
      return map;
    },
    enabled: !!businessId && categories.length > 0,
  });

  const { data: recentEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['service-entries-recent', businessId, branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_entries')
        .select('*, service_categories(name, icon)')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Category mutations
  const saveCatMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: catName.trim(),
        icon: catIcon,
        fixed_price: catFixedPrice ? parseFloat(catFixedPrice) : null,
      };
      if (editCat) {
        const { error } = await supabase.from('service_categories').update(payload).eq('id', editCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('service_categories').insert({ ...payload, business_id: businessId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({ title: editCat ? 'Categoría actualizada' : 'Categoría creada' });
      setCatDialogOpen(false);
      setCatName('');
      setCatIcon('DollarSign');
      setCatFixedPrice('');
      setEditCat(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({ title: 'Categoría eliminada' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        business_id: businessId!,
        branch_id: branchId!,
        user_id: user!.id,
        description: entryDescription.trim() || null,
        amount: parseFloat(entryAmount),
        payment_type: entryIsMixed ? 'mixed' : entryPaymentType,
        is_catalog: !entryIsLive,
      };
      if (entryIsLive) {
        payload.service_name = entryLiveName.trim();
        payload.category_id = null;
      } else {
        payload.category_id = entryCategoryId;
      }
      const { error } = await supabase.from('service_entries').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-entries'] });
      queryClient.invalidateQueries({ queryKey: ['service-entries-recent'] });
      toast({ title: 'Servicio registrado' });
      const catName = entryIsLive ? entryLiveName : categories.find((c: any) => c.id === entryCategoryId)?.name || 'Servicio';
      auditLog(
        'service_charge_created',
        `Cobro de servicio ${catName} por $${parseFloat(entryAmount).toFixed(2)}`,
        undefined,
        'service_entry'
      );
      setEntryDialogOpen(false);
      setEntryDescription('');
      setEntryAmount('');
      setEntryCategoryId('');
      setEntryPaymentType('cash');
      setEntryIsMixed(false);
      setEntryMixedCash('0');
      setEntryMixedTransfer('0');
      setEntryIsLive(false);
      setEntryLiveName('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Promote live service to catalog
  const promoteMutation = useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await supabase
        .from('service_entries')
        .update({ is_catalog: true } as any)
        .eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-entries-recent'] });
      toast({ title: 'Servicio promovido al catálogo' });
      setPromoteEntry(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleOpenNewCat = () => {
    if (!canCreateServiceCategory(categories.length)) {
      toast({ title: 'Límite alcanzado', description: `El plan gratuito permite máximo ${serviceCategoryLimit} categorías de servicio. Mejora tu plan para agregar más.`, variant: 'destructive' });
      return;
    }
    setEditCat(null);
    setCatName('');
    setCatIcon('DollarSign');
    setCatFixedPrice('');
    setCatDialogOpen(true);
  };

  const handleEditCat = (cat: any) => {
    setEditCat(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || 'DollarSign');
    setCatFixedPrice(cat.fixed_price != null ? String(cat.fixed_price) : '');
    setCatDialogOpen(true);
  };

  const handleSelectEntryCategory = (catId: string) => {
    setEntryCategoryId(catId);
    const cat = categories.find((c: any) => c.id === catId);
    if (cat && (cat as any).fixed_price != null && Number((cat as any).fixed_price) > 0) {
      setEntryAmount(String(Number((cat as any).fixed_price)));
    }
  };

  const todayTotal = recentEntries
    .filter(e => new Date(e.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const entryCanSubmit = entryIsLive
    ? !!entryLiveName.trim() && !!entryAmount && parseFloat(entryAmount) > 0 && !createEntryMutation.isPending
    : !!entryCategoryId && !!entryAmount && parseFloat(entryAmount) > 0 && !createEntryMutation.isPending;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Servicios</h1>
          <p className="text-sm text-muted-foreground">Gestión de servicios y cobros</p>
        </div>
        <Button onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } setEntryDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Cobro
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total del día</p>
            <p className="text-2xl font-bold">${todayTotal.toFixed(2)}</p>
          </div>
          <DollarSign className="h-8 w-8 text-primary opacity-50" />
        </CardContent>
      </Card>

      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="catalogo" className="flex-1 text-xs">Catálogo</TabsTrigger>
          <TabsTrigger value="cobros" className="flex-1 text-xs">Cobros</TabsTrigger>
          <TabsTrigger value="analisis" className="flex-1 text-xs">Análisis</TabsTrigger>
        </TabsList>

        {/* ─── Catálogo Tab ─── */}
        <TabsContent value="catalogo">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Categorías de Servicio</CardTitle>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } handleOpenNewCat(); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCats ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay categorías</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat: any) => {
                    const Icon = getIconComponent(cat.icon);
                    return (
                      <div key={cat.id} className="flex items-center justify-between rounded-lg border p-2.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{cat.name}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {cat.fixed_price != null && Number(cat.fixed_price) > 0 && (
                                <span className="text-[10px] text-muted-foreground">${Number(cat.fixed_price).toFixed(2)}</span>
                              )}
                              {(() => {
                                const summaries = costSummaries as Record<string, number | null>;
                                const cost = summaries[cat.id];
                                if (cost === null || cost === undefined) {
                                  return <span className="text-[10px] text-muted-foreground italic">Sin costo configurado</span>;
                                }
                                if (cost === 0) {
                                  return <span className="text-[10px] text-muted-foreground italic">Sin costo configurado</span>;
                                }
                                const price = cat.fixed_price != null ? Number(cat.fixed_price) : 0;
                                const margin = price > 0 ? ((price - cost) / price * 100).toFixed(0) : null;
                                return (
                                  <span className="text-[10px] text-muted-foreground">
                                    Costo: ${cost.toFixed(2)}{margin != null && <span className="text-success ml-1">({margin}%)</span>}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button className="p-1 rounded hover:bg-muted" title="Ficha de costo" onClick={() => { setCostSheetCatId(cat.id); setCostSheetCatName(cat.name); setCostSheetOpen(true); }}>
                              <ClipboardList className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 rounded hover:bg-muted" onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } handleEditCat(cat); }}>
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 rounded hover:bg-muted" onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } deleteCatMutation.mutate(cat.id); }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Cobros Tab ─── */}
        <TabsContent value="cobros">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cobros Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentEntriesList
                entries={recentEntries}
                isLoading={loadingEntries}
                isOwner={isOwner}
                onPromote={(entry) => setPromoteEntry(entry)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Análisis Tab ─── */}
        <TabsContent value="analisis">
          {recentEntries.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Servicios más vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const counts: Record<string, { name: string; count: number; total: number }> = {};
                  recentEntries.forEach((e: any) => {
                    const catName = e.is_catalog === false
                      ? (e.service_name || 'En vivo')
                      : (e.service_categories?.name || 'Sin categoría');
                    if (!counts[catName]) counts[catName] = { name: catName, count: 0, total: 0 };
                    counts[catName].count++;
                    counts[catName].total += Number(e.amount);
                  });
                  const chartData = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
                  const COLORS = [
                    'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
                    'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))',
                    'hsl(var(--muted-foreground))', 'hsl(var(--secondary))',
                  ];
                  return (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} fontSize={11} />
                        <YAxis type="category" dataKey="name" width={100} fontSize={11} tick={{ fill: 'hsl(var(--foreground))' }} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            name === 'count' ? `${value} cobros` : `$${value.toFixed(2)}`,
                            name === 'count' ? 'Cantidad' : 'Total'
                          ]}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="count" name="Cantidad" barSize={14} radius={[0, 4, 4, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground text-center">No hay datos suficientes para el análisis</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCat ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ej: Juegos de PS5" />
            </div>
            <div>
              <Label>Precio fijo (opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={catFixedPrice}
                onChange={(e) => setCatFixedPrice(e.target.value)}
                placeholder="Dejar vacío si el precio varía"
              />
              <p className="text-[10px] text-muted-foreground mt-1">El vendedor puede modificar el monto al registrar</p>
            </div>
            <IconSelector value={catIcon} onChange={setCatIcon} />
            {editCat && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCostSheetCatId(editCat.id);
                  setCostSheetCatName(editCat.name);
                  setCostSheetOpen(true);
                }}
              >
                <ClipboardList className="h-4 w-4 mr-1" /> Configurar ficha de costo
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => saveCatMutation.mutate()} disabled={!catName.trim() || saveCatMutation.isPending}>
              {saveCatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={entryIsLive ? 'outline' : 'default'}
                size="sm"
                className="flex-1"
                onClick={() => setEntryIsLive(false)}
              >
                Catálogo
              </Button>
              <Button
                type="button"
                variant={entryIsLive ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => { setEntryIsLive(true); setEntryCategoryId(''); }}
              >
                <Zap className="h-3.5 w-3.5 mr-1" /> En vivo
              </Button>
            </div>

            {entryIsLive ? (
              <div>
                <Label>Nombre del servicio</Label>
                <Input
                  value={entryLiveName}
                  onChange={(e) => setEntryLiveName(e.target.value)}
                  placeholder="Ej: Cambio de pantalla"
                />
              </div>
            ) : (
              <div>
                <Label>Categoría</Label>
                <Select value={entryCategoryId} onValueChange={handleSelectEntryCategory}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Descripción</Label>
              <Textarea value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} placeholder="Detalle del servicio..." rows={2} />
            </div>
            <div>
              <Label>Monto cobrado ($)</Label>
              <Input type="number" min="0" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="0.00" />
            </div>
            <ServicePaymentSection
              paymentType={entryPaymentType}
              setPaymentType={setEntryPaymentType}
              amount={entryAmount}
              total={parseFloat(entryAmount) || 0}
              isMixed={entryIsMixed}
              setIsMixed={setEntryIsMixed}
              mixedCash={entryMixedCash}
              setMixedCash={setEntryMixedCash}
              mixedTransfer={entryMixedTransfer}
              setMixedTransfer={setEntryMixedTransfer}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => createEntryMutation.mutate()} disabled={!entryCanSubmit}>
              {createEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote Dialog */}
      <Dialog open={!!promoteEntry} onOpenChange={() => setPromoteEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Promover al catálogo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Deseas marcar <strong>"{promoteEntry?.service_name}"</strong> como un servicio oficial del catálogo?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteEntry(null)}>Cancelar</Button>
            <Button onClick={() => promoteMutation.mutate(promoteEntry)} disabled={promoteMutation.isPending}>
              {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Promover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DowngradeModal open={downgradeModalOpen} onOpenChange={setDowngradeModalOpen} />
      {costSheetCatId && (
        <ServiceCostSheet
          categoryId={costSheetCatId}
          categoryName={costSheetCatName}
          businessId={businessId!}
          fixedPrice={categories.find((c: any) => c.id === costSheetCatId)?.fixed_price}
          open={costSheetOpen}
          onOpenChange={(open) => {
            setCostSheetOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
            }
          }}
        />
      )}
    </div>
  );
};

// ─── Main component: route to correct view ───
const Services = () => {
  const { isOwner, isManager, isSuperAdmin, profile } = useAuth();
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const [searchParams] = useSearchParams();
  const isEmpCtx = searchParams.get('ctx') === 'emp';

  const { data: employeeRecord } = useQuery({
    queryKey: ['employee-record-for-services', profile?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, business_id, branch_id, businesses!employees_business_id_fkey(business_type)')
        .eq('email', profile!.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.email,
  });

  const hasEmployeeRecord = !!employeeRecord;
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;
  
  const showEmployeeView = isEmpCtx ? hasEmployeeRecord : (!isPrivileged && hasEmployeeRecord);

  if (!canBypassJornada && !isEmpCtx && jornadaLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canBypassJornada && !isEmpCtx && !jornadaActiva) {
    return <AppLayout><SinJornadaActiva /></AppLayout>;
  }

  if (!canBypassJornada && !isEmpCtx && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente' && jornada?.metodo_apertura !== 'qr') {
    return <AppLayout><SinJornadaAutorizada /></AppLayout>;
  }

  return (
    <AppLayout>
      {showEmployeeView ? (
        <EmployeeServicesView
          employeeBusinessId={employeeRecord!.business_id}
          employeeBranchId={employeeRecord?.branch_id ?? jornada?.sucursal_id ?? profile?.branch_id ?? null}
        />
      ) : (
        <OwnerServicesView />
      )}
    </AppLayout>
  );
};

export default Services;
