import { useState } from 'react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Gamepad2, Monitor, Smartphone, Globe, DollarSign, Send } from 'lucide-react';

const VISION_HABANA_BIZ_ID = '03ab1b9d-c0ff-412c-9b78-c86d320dc41c';

const getCategoryIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('ps4') || lower.includes('juego')) return Gamepad2;
  if (lower.includes('pc') || lower.includes('windows')) return Monitor;
  if (lower.includes('android') || lower.includes('ios')) return Smartphone;
  if (lower.includes('online')) return Globe;
  return DollarSign;
};

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
};

// ─── Employee-facing view: quick service registration ───
const EmployeeServicesView = ({ employeeBusinessId, employeeBranchId }: { employeeBusinessId: string; employeeBranchId: string | null }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = employeeBusinessId;
  const branchId = employeeBranchId;

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');

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
        .select('*, service_categories(name)')
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
      const { error } = await supabase.from('service_entries').insert({
        business_id: businessId!,
        branch_id: branchId!,
        category_id: selectedCatId!,
        user_id: user!.id,
        description: description.trim() || null,
        amount: parseFloat(amount),
        payment_type: paymentType,
      });
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
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const todayTotal = recentEntries
    .filter(e => new Date(e.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const canSubmit = !!selectedCatId && !!amount && parseFloat(amount) > 0 && !createEntryMutation.isPending;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Servicios</h1>
        <p className="text-sm text-muted-foreground">Registra cobros de servicios</p>
      </div>

      {/* Today summary */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total del día</p>
            <p className="text-2xl font-bold">${todayTotal.toFixed(2)}</p>
          </div>
          <DollarSign className="h-8 w-8 text-primary opacity-50" />
        </CardContent>
      </Card>

      {/* Quick register form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar Servicio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category selection as buttons */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Selecciona un servicio</Label>
            {loadingCats ? (
              <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No hay servicios configurados</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat.name);
                  const isSelected = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCatId(isSelected ? null : cat.id)}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description + Amount + Payment inline */}
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

          <Button
            className="w-full"
            onClick={() => createEntryMutation.mutate()}
            disabled={!canSubmit}
          >
            {createEntryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Registrar Cobro
          </Button>
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cobros Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEntries ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay cobros registrados</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {recentEntries.map((entry) => (
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
    </div>
  );
};

// ─── Owner/Manager view: full config + entries ───
const ManagerServicesView = () => {
  const { profile, user, isOwner, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = isOwner || isManager;
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [catName, setCatName] = useState('');

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPaymentType, setEntryPaymentType] = useState('cash');

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
        .select('*, service_categories(name)')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  const saveCatMutation = useMutation({
    mutationFn: async () => {
      if (editCat) {
        const { error } = await supabase.from('service_categories').update({ name: catName.trim() }).eq('id', editCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('service_categories').insert({ business_id: businessId!, name: catName.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({ title: editCat ? 'Categoría actualizada' : 'Categoría creada' });
      setCatDialogOpen(false);
      setCatName('');
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

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('service_entries').insert({
        business_id: businessId!,
        branch_id: branchId!,
        category_id: entryCategoryId,
        user_id: user!.id,
        description: entryDescription.trim() || null,
        amount: parseFloat(entryAmount),
        payment_type: entryPaymentType,
      });
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
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const todayTotal = recentEntries
    .filter(e => new Date(e.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Servicios</h1>
          <p className="text-sm text-muted-foreground">Registra cobros de servicios</p>
        </div>
        <Button onClick={() => setEntryDialogOpen(true)} disabled={categories.length === 0}>
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Categorías de Servicio</CardTitle>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => { setEditCat(null); setCatName(''); setCatDialogOpen(true); }}>
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
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.name);
                return (
                  <div key={cat.id} className="flex items-center justify-between rounded-lg border p-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button className="p-1 rounded hover:bg-muted" onClick={() => { setEditCat(cat); setCatName(cat.name); setCatDialogOpen(true); }}>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cobros Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEntries ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay cobros registrados</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{(entry as any).service_categories?.name}</Badge>
                      <Badge variant="outline" className="text-[10px]">{paymentLabels[entry.payment_type] || entry.payment_type}</Badge>
                    </div>
                    {entry.description && <p className="text-sm text-muted-foreground mt-1 truncate">{entry.description}</p>}
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
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
            <div>
              <Label>Categoría</Label>
              <Select value={entryCategoryId} onValueChange={setEntryCategoryId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button
              onClick={() => createEntryMutation.mutate()}
              disabled={!entryCategoryId || !entryAmount || parseFloat(entryAmount) <= 0 || createEntryMutation.isPending}
            >
              {createEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Cobro'}
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

  // Detect if user is an employee of Vision Habana to show correct view
  const { data: employeeRecord } = useQuery({
    queryKey: ['employee-record-for-services', profile?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, business_id, branch_id')
        .eq('email', profile!.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.email,
  });

  const isVisionHabanaEmployee = employeeRecord?.business_id === VISION_HABANA_BIZ_ID;
  const isPrivileged = isOwner || isManager || isSuperAdmin;

  // If user is an employee of Vision Habana, always show employee view with VH context
  // Otherwise, show manager view for their own business
  const showEmployeeView = isVisionHabanaEmployee;

  // Jornada access control for non-privileged users
  if (!isPrivileged && jornadaLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isPrivileged && !jornadaActiva) {
    return (
      <AppLayout>
        <SinJornadaActiva />
      </AppLayout>
    );
  }

  if (!isPrivileged && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente') {
    return (
      <AppLayout>
        <SinJornadaAutorizada />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showEmployeeView ? (
        <EmployeeServicesView
          employeeBusinessId={employeeRecord!.business_id}
          employeeBranchId={employeeRecord?.branch_id ?? profile?.branch_id ?? null}
        />
      ) : (
        <ManagerServicesView />
      )}
    </AppLayout>
  );
};

export default Services;
