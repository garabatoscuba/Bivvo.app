import { useState } from 'react';
import { useIsDowngraded } from '@/hooks/useIsDowngraded';
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
import { Plus, Pencil, Trash2, Loader2, DollarSign, Send, Zap, ArrowUpCircle } from 'lucide-react';
import IconSelector, { getIconComponent } from '@/components/services/IconSelector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
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
  const [paymentType, setPaymentType] = useState('cash');
  const [isLiveService, setIsLiveService] = useState(false);
  const [liveServiceName, setLiveServiceName] = useState('');

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

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        business_id: businessId!,
        branch_id: branchId!,
        user_id: user!.id,
        description: description.trim() || null,
        amount: parseFloat(amount),
        payment_type: paymentType,
        is_catalog: !isLiveService,
      };
      if (isLiveService) {
        payload.service_name = liveServiceName.trim();
        payload.category_id = null;
      } else {
        payload.category_id = selectedCatId!;
      }
      const { error } = await supabase.from('service_entries').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-entries'] });
      queryClient.invalidateQueries({ queryKey: ['service-entries-recent'] });
      toast({ title: '✓ Servicio registrado' });
      setDescription('');
      setAmount('');
      setSelectedCatId(null);
      setPaymentType('cash');
      setIsLiveService(false);
      setLiveServiceName('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleSelectCategory = (catId: string) => {
    setIsLiveService(false);
    if (selectedCatId === catId) {
      setSelectedCatId(null);
      setAmount('');
      return;
    }
    setSelectedCatId(catId);
    const cat = categories.find((c: any) => c.id === catId);
    if (cat && (cat as any).fixed_price != null && Number((cat as any).fixed_price) > 0) {
      setAmount(String(Number((cat as any).fixed_price)));
    }
  };

  const handleLiveToggle = () => {
    setIsLiveService(!isLiveService);
    setSelectedCatId(null);
    setAmount('');
  };

  const todayEntries = recentEntries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString());
  const todayTotal = todayEntries.reduce((sum, e) => sum + Number(e.amount), 0);

  const canSubmit = isLiveService
    ? !!liveServiceName.trim() && !!amount && parseFloat(amount) > 0 && !createEntryMutation.isPending
    : !!selectedCatId && !!amount && parseFloat(amount) > 0 && !createEntryMutation.isPending;

  return (
    <>
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Servicios</h1>
        <p className="text-sm text-muted-foreground">Registra cobros de servicios</p>
      </div>

      {loadingRegister ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !hasOpenRegister ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 opacity-40 mb-3" />
            <p className="text-sm font-medium">Debes abrir tu caja primero</p>
            <p className="text-xs mt-1">Ve al módulo Caja para abrir tu caja antes de registrar servicios.</p>
          </CardContent>
        </Card>
      ) : (
        <>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total del día</p>
            <p className="text-2xl font-bold">${todayTotal.toFixed(2)}</p>
          </div>
          <DollarSign className="h-8 w-8 text-primary opacity-50" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registrar Servicio</CardTitle>
            <Button
              variant={isLiveService ? 'default' : 'outline'}
              size="sm"
              onClick={handleLiveToggle}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              En vivo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLiveService ? (
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del servicio</Label>
              <Input
                value={liveServiceName}
                onChange={(e) => setLiveServiceName(e.target.value)}
                placeholder="Ej: Reparación de pantalla"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Este servicio no se agrega al catálogo automáticamente</p>
            </div>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Selecciona un servicio</Label>
              {loadingCats ? (
                <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No hay servicios configurados</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat: any) => {
                    const Icon = getIconComponent(cat.icon);
                    const isSelected = selectedCatId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{cat.name}</span>
                          {cat.fixed_price != null && Number(cat.fixed_price) > 0 && (
                            <span className="text-[10px] text-muted-foreground">${Number(cat.fixed_price).toFixed(2)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle del servicio..."
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Monto ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pago</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={() => { if (isDowngraded) { setDowngradeModalOpen(true); return; } createEntryMutation.mutate(); }} disabled={!canSubmit}>
            {createEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Registrar Cobro
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cobros Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentEntriesList entries={todayEntries} isLoading={loadingEntries} isOwner={false} />
        </CardContent>
      </Card>
      </>
      )}
    </div>
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
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const canManage = isOwner || isManager;
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string; icon?: string; fixed_price?: number | null } | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('DollarSign');
  const [catFixedPrice, setCatFixedPrice] = useState('');

  // Entry dialog state
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPaymentType, setEntryPaymentType] = useState('cash');
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
        payment_type: entryPaymentType,
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
      setEntryDialogOpen(false);
      setEntryDescription('');
      setEntryAmount('');
      setEntryCategoryId('');
      setEntryPaymentType('cash');
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
                            {cat.fixed_price != null && Number(cat.fixed_price) > 0 && (
                              <span className="text-[10px] text-muted-foreground">${Number(cat.fixed_price).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button className="p-1 rounded hover:bg-muted" onClick={() => handleEditCat(cat)}>
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 rounded hover:bg-muted" onClick={() => deleteCatMutation.mutate(cat.id)}>
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
            <div>
              <Label>Método de pago</Label>
              <Select value={entryPaymentType} onValueChange={setEntryPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

  if (!canBypassJornada && !isEmpCtx && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente') {
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
