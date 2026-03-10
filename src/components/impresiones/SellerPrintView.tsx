import { useState, useMemo } from 'react';
import { useRawMaterials, usePrintServiceTypes, usePrintRecipes, useEmployeesForTransfer, usePrintMaterialTypes, useActiveSheets, useOpenSheet, useCloseSheet } from '@/hooks/usePrintData';
import { useActivePrinters } from '@/hooks/usePrintPrinters';
import { useMyMaterialStock } from '@/hooks/useEmployeeMaterialStock';
import { useRegisterPrintShrinkage } from '@/hooks/usePrintShrinkage';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Printer, Package, AlertTriangle, Plus, Trash2, Loader2,
  Banknote, ArrowLeftRight, ClipboardMinus, ChefHat, CheckCircle2,
  Smartphone, RotateCcw, AlertCircle, CreditCard, DollarSign, Send, FileText,
} from 'lucide-react';
import { getIconComponent } from '@/components/services/IconSelector';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────
interface JobItem {
  service_type_id: string;
  service_name: string;
  cantidad: number;
  es_doble_cara: boolean;
  es_color: boolean;
  es_full: boolean;
  precio_cobrado: number;
  costo_insumo: number;
  material_consumed: number;
  material_id: string | null;
  nota: string;
}

type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mixed';
const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
const CART_QUICK_AMOUNTS = [1, 5, 10, 20, 50];

// ─── Component ────────────────────────────────────────────────
const SellerPrintView = () => {
  const { profile, user } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const { toast } = useToast();
  const auditLog = useAuditLog();
  const queryClient = useQueryClient();

  const { data: materials = [], isLoading: matLoading } = useRawMaterials();
  const { data: myStocks = [] } = useMyMaterialStock(user?.id);
  const { data: services = [] } = usePrintServiceTypes();
  const { data: recipes = [] } = usePrintRecipes();
  const { data: materialTypes = [] } = usePrintMaterialTypes();

  const activeServices = useMemo(() => services.filter((s: any) => s.is_active), [services]);
  const { data: activeSheets = [] } = useActiveSheets();
  const openSheetMut = useOpenSheet();
  const closeSheetMut = useCloseSheet();
  const registerShrinkage = useRegisterPrintShrinkage();

  // Count tramos used per active sheet (print_job_items since sheet opened)
  const { data: tramoUsageMap = {} } = useQuery({
    queryKey: ['tramo-usage', activeSheets.map((s: any) => s.id).join(',')],
    queryFn: async () => {
      if (activeSheets.length === 0) return {};
      const map: Record<string, number> = {};
      for (const sheet of activeSheets as any[]) {
        const { data } = await supabase
          .from('print_job_items')
          .select('cantidad, job_id, print_jobs!inner(branch_id, created_at)')
          .gte('print_jobs.created_at', sheet.created_at)
          .eq('print_jobs.branch_id', branchId!);
        // Filter items that use a service with this sheet's material and vende_por_tramos
        const tramoServiceIds = activeServices
          .filter((s: any) => s.vende_por_tramos && s.material_id === sheet.material_id)
          .map((s: any) => s.id);
        const total = (data || [])
          .filter((item: any) => tramoServiceIds.includes(item.service_type_id))
          .reduce((sum: number, item: any) => sum + Number(item.cantidad), 0);
        map[sheet.id] = total;
      }
      return map;
    },
    enabled: activeSheets.length > 0 && !!branchId,
    refetchInterval: 30000,
  });

  // Open sheet modal state
  const [openSheetDialog, setOpenSheetDialog] = useState(false);
  const [openSheetForm, setOpenSheetForm] = useState({ material_id: '' });

  // Active cash register for this user
  const { data: activeCaja, isLoading: loadingCaja } = useQuery({
    queryKey: ['active-cash-register', branchId, user?.id],
    queryFn: async () => {
      if (!branchId || !user?.id) return null;
      const { data } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('branch_id', branchId)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();
      return data;
    },
    enabled: !!branchId && !!user?.id,
  });

  // Recent jobs for today
  const { data: recentJobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['print-jobs-recent', businessId, branchId, user?.id],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*, print_job_items(service_type_id, cantidad, precio_cobrado, es_doble_cara, es_color, es_full, nota)')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('user_id', user!.id)
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && !!branchId && !!user?.id,
  });

  // State for viewing notes
  const [viewingNote, setViewingNote] = useState<string | null>(null);

  const todayTotal = useMemo(() => recentJobs.reduce((s: number, j: any) => s + Number(j.total), 0), [recentJobs]);

  // ─── Inline Job State ──────────────────────────────────────
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isMixed, setIsMixed] = useState(false);
  const [mixedCash, setMixedCash] = useState('0');
  const [mixedTransfer, setMixedTransfer] = useState('0');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // ─── Shrinkage Modal ───────────────────────────────────────
  const [shrinkOpen, setShrinkOpen] = useState(false);
  const [shrinkForm, setShrinkForm] = useState({ material_id: '', cantidad: 0, costo_unitario: 0, motivo: '', nota: '' });

  // ─── Production Modal ──────────────────────────────────────
  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ recipe_id: '', cantidad_producida: 1, nota: '' });

  // ─── Helpers ────────────────────────────────────────────────
  const getMaterial = (id: string | null) => materials.find((m: any) => m.id === id);
  const getMyStock = (materialId: string) => {
    const record = myStocks.find((s: any) => s.material_id === materialId);
    return record ? Number(record.stock) : 0;
  };

  const addJobItem = (svc: any) => {
    setJobItems(prev => [
      ...prev,
      {
        service_type_id: svc.id,
        service_name: svc.name,
        cantidad: 1,
        es_doble_cara: false,
        es_color: false,
        es_full: false,
        precio_cobrado: svc.precio_base > 0 ? svc.precio_base : ('' as any),
        costo_insumo: svc.material_id ? (getMaterial(svc.material_id)?.costo_unitario || 0) * svc.consumo_por_unidad : 0,
        material_consumed: svc.consumo_por_unidad,
        material_id: svc.material_id,
        nota: '',
      },
    ]);
  };

  const updateJobItem = (idx: number, field: string, value: any) => {
    setJobItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'cantidad') {
        const svc = activeServices.find((s: any) => s.id === item.service_type_id);
        if (svc && svc.material_id) {
          const mat = getMaterial(svc.material_id);
          updated.costo_insumo = (mat?.costo_unitario || 0) * svc.consumo_por_unidad * value;
          updated.material_consumed = svc.consumo_por_unidad * value;
        }
      }
      return updated;
    }));
  };

  const removeJobItem = (idx: number) => setJobItems(prev => prev.filter((_, i) => i !== idx));

  const jobTotal = useMemo(() => jobItems.reduce((s, it) => s + (Number(it.precio_cobrado) || 0) * it.cantidad, 0), [jobItems]);

  const materialConsumption = useMemo(() => {
    const map = new Map<string, { name: string; needed: number; available: number; isTramo: boolean }>();
    jobItems.forEach(it => {
      if (!it.material_id) return;
      const mat = getMaterial(it.material_id);
      if (!mat) return;
      const svc = activeServices.find((s: any) => s.id === it.service_type_id);
      const isTramo = !!svc?.vende_por_tramos;
      const myStock = getMyStock(it.material_id);
      const existing = map.get(it.material_id) || { name: mat.name, needed: 0, available: myStock, isTramo };
      if (isTramo) existing.isTramo = true;
      existing.needed += it.material_consumed;
      map.set(it.material_id, existing);
    });
    return Array.from(map.entries());
  }, [jobItems, materials, activeServices, myStocks]);

  const hasStockIssue = materialConsumption.some(([, v]) => v.needed > v.available && !v.isTramo);

  // Check tramo services: verify active sheet exists for the material
  const tramoIssues = useMemo(() => {
    const issues: { materialId: string; materialName: string }[] = [];
    const checked = new Set<string>();
    jobItems.forEach(it => {
      if (!it.material_id) return;
      const svc = activeServices.find((s: any) => s.id === it.service_type_id);
      if (!svc?.vende_por_tramos) return;
      if (checked.has(it.material_id)) return;
      checked.add(it.material_id);
      const mat = getMaterial(it.material_id);
      if (!mat) return;
      const sheet = activeSheets.find((s: any) => s.material_id === it.material_id && s.status === 'activa');
      if (!sheet) {
        issues.push({ materialId: it.material_id, materialName: mat.name });
      }
    });
    return issues;
  }, [jobItems, activeServices, activeSheets, materials]);

  // (tramoInfo removed - no longer tracking tramos)

  // Payment helpers
  const paymentOptions: { value: PaymentMethod; label: string; Icon: React.ElementType }[] = [
    { value: 'cash', label: 'Efectivo', Icon: Banknote },
    { value: 'card', label: 'Tarjeta', Icon: CreditCard },
    { value: 'transfer', label: 'Transferencia', Icon: Smartphone },
  ];

  const handlePaymentSelect = (value: PaymentMethod) => {
    if (isMixed) {
      if (value === 'cash' || value === 'transfer') {
        setIsMixed(false);
        setPaymentMethod(value);
        return;
      }
    }
    if (
      (paymentMethod === 'cash' && value === 'transfer') ||
      (paymentMethod === 'transfer' && value === 'cash')
    ) {
      setIsMixed(true);
      setMixedCash('0');
      setMixedTransfer(jobTotal > 0 ? jobTotal.toFixed(2) : '0');
      return;
    }
    setIsMixed(false);
    setPaymentMethod(value);
  };

  const isPaymentActive = (v: PaymentMethod) => isMixed ? (v === 'cash' || v === 'transfer') : paymentMethod === v;

  const canSubmit = jobItems.length > 0 && jobTotal > 0 && tramoIssues.length === 0;

  // ─── Submit Job ─────────────────────────────────────────────
  const jobMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id) throw new Error('Sin contexto');

      const finalPayment = isMixed ? 'mixed' : paymentMethod;

      const { data: job, error: jobErr } = await supabase
        .from('print_jobs')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          user_id: user.id,
          total: jobTotal,
          payment_method: finalPayment,
          nota: description.trim() || null,
        })
        .select('id')
        .single();
      if (jobErr) throw jobErr;

      const items = jobItems.map(it => ({
        job_id: job.id,
        service_type_id: it.service_type_id,
        cantidad: it.cantidad,
        es_doble_cara: it.es_doble_cara,
        es_color: it.es_color,
        es_full: it.es_full,
        precio_cobrado: Number(it.precio_cobrado) || 0,
        costo_insumo: it.costo_insumo,
        material_consumido: it.material_consumed,
        nota: it.nota || null,
      }));
      const { error: itemsErr } = await supabase.from('print_job_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Deduct stock only for non-tramo materials from employee's personal stock
      for (const [matId, info] of materialConsumption) {
        const mat = getMaterial(matId);
        if (!mat) continue;
        const matType = materialTypes.find((t: any) => t.id === mat.material_type_id);
        if (matType?.permite_tramos) continue; // tramos managed via print_active_sheets
        // Find employee record
        const { data: emp } = await supabase.from('employees').select('id').eq('business_id', businessId).eq('auth_user_id', user.id).maybeSingle();
        if (emp) {
          const { data: empStock } = await supabase.from('employee_material_stock' as any).select('id, stock').eq('employee_id', emp.id).eq('material_id', matId).maybeSingle();
          if (empStock) {
            await supabase.from('employee_material_stock' as any).update({
              stock: Math.max(0, (empStock as any).stock - info.needed),
              updated_at: new Date().toISOString(),
            }).eq('id', (empStock as any).id);
          }
        }
      }

      if (activeCaja?.id && (finalPayment === 'cash' || finalPayment === 'mixed')) {
        await supabase.from('cash_register_movements' as any).insert({
          cash_register_id: activeCaja.id,
          branch_id: branchId,
          business_id: businessId,
          user_id: user.id,
          movement_type: 'insertion',
          amount: jobTotal,
          reason: `Trabajo de impresión ($${jobTotal.toFixed(2)})`,
        });
      }

      auditLog('print_job_created', `Trabajo de impresión por $${jobTotal.toFixed(2)} (${jobItems.length} items)`, job.id, 'print_job');
      return job.id;
    },
    onSuccess: () => {
      toast({ title: '✓ Trabajo registrado' });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['caja-movements'] });
      queryClient.invalidateQueries({ queryKey: ['print-jobs-recent'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-stock'] });
      queryClient.invalidateQueries({ queryKey: ['employee-material-stock'] });
      setJobItems([]);
      setDescription('');
      setPaymentMethod('cash');
      setIsMixed(false);
      setMixedCash('0');
      setMixedTransfer('0');
      setPaymentDialogOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ─── Submit Shrinkage ──────────────────────────────────────
  const handleSubmitShrinkage = () => {
    if (!shrinkForm.material_id || shrinkForm.cantidad <= 0) {
      toast({ title: 'Error', description: 'Material y cantidad son obligatorios', variant: 'destructive' });
      return;
    }

    registerShrinkage.mutate(
      {
        material_id: shrinkForm.material_id,
        cantidad: shrinkForm.cantidad,
        costo_unitario: shrinkForm.costo_unitario,
        motivo: shrinkForm.motivo || 'Sin especificar',
        nota: shrinkForm.nota,
      },
      {
        onSuccess: () => {
          setShrinkForm({ material_id: '', cantidad: 0, costo_unitario: 0, motivo: '', nota: '' });
          setShrinkOpen(false);
        },
      }
    );
  };

  // ─── Submit Production ─────────────────────────────────────
  const activeRecipes = recipes.filter((r: any) => r.is_active);
  const selectedRecipe = useMemo(() => recipes.find((r: any) => r.id === prodForm.recipe_id), [recipes, prodForm.recipe_id]);

  const prodConsumption = useMemo(() => {
    if (!selectedRecipe) return [];
    return ((selectedRecipe as any).print_recipe_materials || []).map((rm: any) => {
      const mat = getMaterial(rm.material_id);
      const needed = rm.cantidad_por_produccion * prodForm.cantidad_producida;
      return { material_id: rm.material_id, name: mat?.name || '—', needed, available: getMyStock(rm.material_id) };
    });
  }, [selectedRecipe, prodForm.cantidad_producida, materials, myStocks]);

  const prodMutation = useMutation({
    mutationFn: async () => {
      if (!businessId || !branchId || !user?.id || !selectedRecipe) throw new Error('Sin contexto');
      const { error } = await supabase.from('print_productions').insert({
        business_id: businessId,
        branch_id: branchId,
        user_id: user.id,
        recipe_id: selectedRecipe.id,
        cantidad_producida: prodForm.cantidad_producida,
        nota: prodForm.nota || null,
      });
      if (error) throw error;
      // Deduct from employee's personal stock
      const { data: emp } = await supabase.from('employees').select('id').eq('business_id', businessId).eq('auth_user_id', user.id).maybeSingle();
      if (emp) {
        for (const pc of prodConsumption) {
          const { data: empStock } = await supabase.from('employee_material_stock' as any).select('id, stock').eq('employee_id', emp.id).eq('material_id', pc.material_id).maybeSingle();
          if (empStock) {
            await supabase.from('employee_material_stock' as any).update({
              stock: Math.max(0, (empStock as any).stock - pc.needed),
              updated_at: new Date().toISOString(),
            }).eq('id', (empStock as any).id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: `Producción registrada: ${prodForm.cantidad_producida} × ${(selectedRecipe as any)?.name}` });
      setProdForm({ recipe_id: '', cantidad_producida: 1, nota: '' });
      setProdOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (matLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', mixed: 'Mixto',
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-3 md:p-4">
      {loadingCaja ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !activeCaja ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 opacity-40 mb-3" />
            <p className="text-sm font-medium">Debes abrir tu caja primero</p>
            <p className="text-xs mt-1">Ve al módulo Caja para abrir tu caja.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-8rem)]">
          {/* ─── Left Panel: Stock + Services ─── */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h1 className="text-xl font-bold">Impresiones</h1>
                <p className="text-xs text-muted-foreground">Registra trabajos de impresión</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShrinkOpen(true)} title="Registrar merma">
                  <ClipboardMinus className="h-4 w-4" />
                </Button>
                {activeRecipes.length > 0 && (
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setProdOpen(true)} title="Producción">
                    <ChefHat className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Stock strip */}
            {materials.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none shrink-0 pb-1">
                {materials.map((m: any) => {
                  const myStock = getMyStock(m.id);
                  const isLow = myStock <= 0;
                  const matType = materialTypes.find((t: any) => t.id === m.material_type_id);
                  const isTramo = matType?.permite_tramos === true;
                  const sheet = isTramo ? (activeSheets as any[]).find((s: any) => s.material_id === m.id && s.status === 'activa') : null;
                  const tramoCount = sheet ? (tramoUsageMap[(sheet as any).id] || 0) : 0;
                  return (
                    <div key={m.id} className={cn('flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-shrink-0', isLow && !isTramo && 'border-destructive bg-destructive/5')}>
                      <span className="text-xs font-medium whitespace-nowrap">{m.name}</span>
                      <Badge variant={isLow && !isTramo ? 'destructive' : 'secondary'} className="text-xs">
                        {isTramo && sheet ? `🗎 ${tramoCount}` : myStock}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Services grid */}
            <div className="flex-1 overflow-y-auto pb-4 lg:pb-0">
              {activeServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Printer className="h-10 w-10 opacity-30 mb-2" />
                  <p className="text-sm">No hay servicios configurados</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {activeServices.map((svc: any) => {
                    const SvcIcon = getIconComponent(svc.icon);
                    const count = jobItems.filter(it => it.service_type_id === svc.id).reduce((s, it) => s + it.cantidad, 0);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => addJobItem(svc)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:shadow-sm',
                          count > 0 ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className={cn('rounded-lg p-2', count > 0 ? 'bg-primary/10' : 'bg-muted')}>
                          <SvcIcon className={cn('h-4 w-4', count > 0 ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{svc.name}</p>
                          {svc.precio_base > 0 && (
                            <p className="text-[11px] text-muted-foreground">${Number(svc.precio_base).toFixed(2)}</p>
                          )}
                        </div>
                        {count > 0 && <Badge className="shrink-0 text-xs">{count}</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Recent jobs */}
              {recentJobs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recientes</p>
                  {recentJobs.slice(0, 5).map((job: any) => {
                    const items = job.print_job_items || [];
                    return (
                      <div key={job.id} className="rounded-lg border p-2.5 space-y-1.5">
                        {items.map((it: any, i: number) => {
                          const svc = activeServices.find((s: any) => s.id === it.service_type_id);
                          const svcName = svc?.name || 'Servicio';
                          const flags: string[] = [];
                          if (it.es_doble_cara) flags.push('Doble cara');
                          if (it.es_color) flags.push('Color');
                          if (it.es_full) flags.push('Full');
                          return (
                            <div key={i} className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium">{svcName}</span>
                              <Badge variant="secondary" className="text-[10px]">×{it.cantidad}</Badge>
                              {flags.map(f => (
                                <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                              ))}
                              {it.nota && (
                                <button
                                  className="text-[10px] text-primary underline cursor-pointer"
                                  onClick={() => setViewingNote(it.nota)}
                                >
                                  Ver nota
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{paymentLabels[job.payment_method] || job.payment_method}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(job.created_at).toLocaleString('es', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-xs font-bold">${Number(job.total).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Right Panel: Cart ─── */}
          <Card className="w-full lg:w-96 flex flex-col lg:max-h-full overflow-hidden flex-shrink-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm font-medium">Detalle del trabajo</CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto px-4 space-y-3">
              {jobItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Printer className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">Selecciona servicios para agregar</p>
                </div>
              ) : (
                <>
                  {jobItems.map((item, idx) => {
                    const svc = activeServices.find((s: any) => s.id === item.service_type_id);
                    const isTramo = !!svc?.vende_por_tramos;
                    const sheet = isTramo && item.material_id ? (activeSheets as any[]).find((s: any) => s.material_id === item.material_id && s.status === 'activa') : null;
                    const mat = item.material_id ? getMaterial(item.material_id) : null;
                    const myStock = item.material_id ? getMyStock(item.material_id) : 0;
                    const hasStock = myStock > 0;
                    return (
                      <div key={idx} className="rounded-lg border p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.service_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input type="number" min={1} className="h-7 w-14 text-xs text-center" value={item.cantidad} onChange={e => updateJobItem(idx, 'cantidad', parseInt(e.target.value) || 1)} />
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input type="number" min={0} step="0.01" className="h-7 w-20 text-xs text-right" value={item.precio_cobrado === ('' as any) ? '' : item.precio_cobrado} onChange={e => updateJobItem(idx, 'precio_cobrado', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} placeholder="0.00" />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeJobItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {(svc?.admite_doble_cara || svc?.admite_color || svc?.admite_full) && (
                          <div className="flex items-center gap-4 pl-1">
                            {svc?.admite_doble_cara && (
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <Switch className="scale-75" checked={item.es_doble_cara} onCheckedChange={v => updateJobItem(idx, 'es_doble_cara', v)} />
                                Doble cara
                              </label>
                            )}
                            {svc?.admite_color && (
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <Switch className="scale-75" checked={item.es_color} onCheckedChange={v => updateJobItem(idx, 'es_color', v)} />
                                Color
                              </label>
                            )}
                            {svc?.admite_full && (
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <Switch className="scale-75" checked={item.es_full} onCheckedChange={v => updateJobItem(idx, 'es_full', v)} />
                                Full
                              </label>
                            )}
                          </div>
                        )}
                        {/* Quick price buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {CART_QUICK_AMOUNTS.map(amount => (
                            <Button key={amount} type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateJobItem(idx, 'precio_cobrado', (Number(item.precio_cobrado) || 0) + amount)}>
                              ${amount}
                            </Button>
                          ))}
                          <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateJobItem(idx, 'precio_cobrado', '' as any)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                        {isTramo && sheet && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-7"
                            disabled={closeSheetMut.isPending || openSheetMut.isPending || !hasStock}
                            onClick={async () => {
                              await closeSheetMut.mutateAsync(sheet.id);
                              if (hasStock && user?.id) {
                                openSheetMut.mutate({ material_id: item.material_id!, user_id: user.id });
                              }
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            {hasStock ? `Insertar otra hoja de ${mat?.name || ''}` : `Sin stock de ${mat?.name || ''}`}
                          </Button>
                        )}
                      </div>
                    );
                  })}

                  {/* Tramo warnings */}
                  {tramoIssues.length > 0 && (
                    <div className="rounded-md border border-warning/50 bg-warning/10 p-2.5 space-y-2">
                      {tramoIssues.map(issue => (
                        <div key={issue.materialId} className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Sin hoja activa: <strong>{issue.materialName}</strong></span>
                          </div>
                          <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => { setOpenSheetForm({ material_id: issue.materialId }); setOpenSheetDialog(true); }}>
                            <FileText className="h-3 w-3 mr-1" /> Abrir hoja
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasStockIssue && (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Stock insuficiente</span>
                    </div>
                  )}

                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Nota (opcional)..." rows={2} className="text-sm" />
                </>
              )}
            </div>
            {jobItems.length > 0 && (
              <div className="p-4 border-t space-y-2 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">${jobTotal.toFixed(2)}</span>
                </div>
                <Button className="w-full h-11 font-bold" onClick={() => setPaymentDialogOpen(true)} disabled={!canSubmit}>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Cobrar ${jobTotal.toFixed(2)}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── Payment Dialog ─── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Procesar Pago</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Artículos ({jobItems.reduce((s, it) => s + it.cantidad, 0)})</span>
                <span className="text-lg font-bold text-primary">${jobTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Método de Pago</Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentOptions.map(({ value, label, Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={isPaymentActive(value) ? 'default' : 'outline'}
                    className={cn('flex-col h-auto py-3', isPaymentActive(value) && 'ring-2 ring-primary')}
                    onClick={() => handlePaymentSelect(value)}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
              {isMixed && <p className="text-xs text-muted-foreground text-center">Pago mixto: Efectivo + Transferencia</p>}
            </div>

            {(paymentMethod === 'cash' || isMixed) && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-sm"><Banknote className="h-4 w-4" /> Efectivo</Label>
                  <Input type="number" step="0.01" min="0" value={mixedCash} onChange={e => setMixedCash(e.target.value)} className="text-lg font-medium text-right" />
                  <div className="flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map(a => (
                      <Button key={a} type="button" variant="outline" size="sm" onClick={() => setMixedCash(p => (Number(p) + a).toString())}>${a}</Button>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setMixedCash(jobTotal.toFixed(2))}>Exacto</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setMixedCash('0')}><RotateCcw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {isMixed && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-sm"><Smartphone className="h-4 w-4" /> Transferencia</Label>
                    <Input type="number" step="0.01" min="0" value={mixedTransfer} onChange={e => setMixedTransfer(e.target.value)} className="text-lg font-medium text-right" />
                  </div>
                )}
              </div>
            )}

            {!isMixed && paymentMethod === 'cash' && Number(mixedCash) > jobTotal && jobTotal > 0 && (
              <div className="rounded-lg bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">Cambio</p>
                <p className="text-2xl font-bold text-primary">${(Number(mixedCash) - jobTotal).toFixed(2)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={jobMutation.isPending}>Cancelar</Button>
            <Button onClick={() => jobMutation.mutate()} disabled={!canSubmit || jobMutation.isPending} className="min-w-32">
              {jobMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── SHRINKAGE MODAL ───────────────────────────── */}
      <Dialog open={shrinkOpen} onOpenChange={setShrinkOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Merma</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Select value={shrinkForm.material_id} onValueChange={v => {
                const mat = materials.find((m: any) => m.id === v);
                setShrinkForm(f => ({ ...f, material_id: v, costo_unitario: mat?.costo_unitario || 0 }));
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {materials.filter((m: any) => getMyStock(m.id) > 0).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} (Stock: {getMyStock(m.id)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={shrinkForm.cantidad || ''} onChange={e => setShrinkForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Costo unitario ($)</Label>
              <Input type="number" min={0} step="0.01" value={shrinkForm.costo_unitario || ''} onChange={e => setShrinkForm(f => ({ ...f, costo_unitario: parseFloat(e.target.value) || 0 }))} placeholder="Precio por unidad dañada" />
            </div>
            {shrinkForm.cantidad > 0 && shrinkForm.costo_unitario > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm space-y-1">
                <p className="font-medium text-destructive">Daño estimado: ${(shrinkForm.cantidad * shrinkForm.costo_unitario).toFixed(2)}</p>
              </div>
            )}
            <div>
              <Label>Motivo</Label>
              <Input value={shrinkForm.motivo} onChange={e => setShrinkForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Atasco en impresora" />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={shrinkForm.nota} onChange={e => setShrinkForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShrinkOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSubmitShrinkage} 
              disabled={!shrinkForm.material_id || !shrinkForm.cantidad || registerShrinkage.isPending}
            >
              {registerShrinkage.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar merma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PRODUCTION MODAL ──────────────────────────── */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Producción</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Receta</Label>
              <Select value={prodForm.recipe_id} onValueChange={v => setProdForm(f => ({ ...f, recipe_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar receta" /></SelectTrigger>
                <SelectContent>
                  {activeRecipes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name} (produce {r.unidades_produce})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad producida</Label>
              <Input type="number" min={1} value={prodForm.cantidad_producida} onChange={e => setProdForm(f => ({ ...f, cantidad_producida: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={prodForm.nota} onChange={e => setProdForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>
            {prodConsumption.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-muted-foreground">Insumos a consumir:</p>
                {prodConsumption.map((pc: any) => (
                  <div key={pc.material_id} className={`flex justify-between ${pc.needed > pc.available ? 'text-destructive font-medium' : ''}`}>
                    <span>{pc.name}</span>
                    <span>{pc.needed} / {pc.available} disp.</span>
                  </div>
                ))}
                {prodConsumption.some((pc: any) => pc.needed > pc.available) && (
                  <div className="flex items-center gap-1 text-destructive mt-1">
                    <AlertTriangle className="h-3 w-3" /><span>Stock insuficiente</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button onClick={() => prodMutation.mutate()} disabled={!prodForm.recipe_id || prodMutation.isPending}>
              {prodMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar producción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Sheet Dialog */}
      <Dialog open={openSheetDialog} onOpenChange={setOpenSheetDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Abrir hoja nueva</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Input value={getMaterial(openSheetForm.material_id)?.name || ''} disabled className="bg-muted" />
            </div>
            <p className="text-xs text-muted-foreground">Se descontará 1 unidad de tu stock.</p>
            {openSheetForm.material_id && (
              <p className="text-xs text-muted-foreground">
                Stock disponible: {getMyStock(openSheetForm.material_id)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSheetDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!profile?.user_id) return;
                openSheetMut.mutate(
                  { material_id: openSheetForm.material_id, user_id: profile.user_id },
                  {
                    onSuccess: () => {
                      setOpenSheetDialog(false);
                      setOpenSheetForm({ material_id: '' });
                      queryClient.invalidateQueries({ queryKey: ['print-active-sheets'] });
                    },
                  }
                );
              }}
              disabled={!openSheetForm.material_id || openSheetMut.isPending || getMyStock(openSheetForm.material_id) < 1}
            >
              {openSheetMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Abrir hoja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Note Viewer Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={() => setViewingNote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nota</DialogTitle></DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{viewingNote}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingNote(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerPrintView;
